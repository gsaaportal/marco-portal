import sys
import csv
import simplejson as json
import inspect
import requests
from urlparse import urlparse
import logging
import logging.config
import codecs
import string 
from django.template import Template
from django.template.loader import render_to_string
from django.core.management.base import BaseCommand, CommandError
from data_manager.models import *
from esriRest import *

def UnicodeDictReader(utf8_data, fieldNames, **kwargs):    
    csv_reader = csv.DictReader(utf8_data, **kwargs)
    for row in csv_reader:
      yield dict([(key, unicode(value, 'utf-8')) for key, value in row.iteritems()])

fieldNames = [
              "REST LAYER",
              "DATA LAYER",
              "PARENT LAYER",
              "SOURCE",
              "SOURCE URL",
              "TOPICS",
              "MAIN THEME",
              "SubTheme",
              "Raw Data Link",
              "REST Endpoint",
              "REST Array Number",
              "REST Sublayer Array Numbers",
              "source metadata url",
              "local metadata url",
              "Comments",
              "kml",
              "Attributes",
              "Attributes Display Name",
              "Hover Description",
              "Description"                                
              ]


class Topic(object):
  def __init__(self):
    self.pk = None
    self.model = "data_manager.topic"
    
    self.display_name = ""
    self.name = ""
    self.header_image = ""
    self.header_attrib = ""
    self.overview = ""
    self.description = ""
    self.thumbnail = ""

    self.factsheet_thumb = ""
    self.factsheet_link = ""

    # not really using these atm    
    self.feature_image = ""
    self.feature_excerpt = ""
    self.feature_link = ""
  def buildDict(self):
    pr = {}
    pr['fields'] = {}
    for name in dir(self):
      value = getattr(self, name)
      if not name.startswith('__') and not inspect.ismethod(value):
        if(name != 'pk' and name != 'model'):
          pr['fields'][name] = unicode(value)
        else:
          pr[name] = unicode(value)
    return pr    

class Theme(object):
  def __init__(self):
    self.pk = None
    self.model = "data_manager.theme"
    
    self.display_name = ""
    self.name = ""
    self.header_image = ""
    self.header_attrib = ""
    self.overview = ""
    self.description = ""
    self.thumbnail = ""

    self.factsheet_thumb = ""
    self.factsheet_link = ""

    # not really using these atm    
    self.feature_image = ""
    self.feature_excerpt = ""
    self.feature_link = ""
    
  def buildDict(self):
    pr = {}
    pr['fields'] = {}
    for name in dir(self):
      value = getattr(self, name)
      if not name.startswith('__') and not inspect.ismethod(value):
        if(name != 'pk' and name != 'model'):
          pr['fields'][name] = unicode(value)
        else:
          pr[name] = unicode(value)
    return pr    

class AttributeInfo(object):
  def __init__(self):
    self.pk = None
    self.model = "data_manager.attributeinfo"
    self.display_name = ""
    self.field_name = ""
    self.precision = 1
    self.order = 1

  def buildDict(self):
    pr = {}
    pr['fields'] = {}
    for name in dir(self):
      value = getattr(self, name)
      if not name.startswith('__') and not inspect.ismethod(value):
        if(name != 'pk' and name != 'model'):
          pr['fields'][name] = unicode(value)
        else:
          pr[name] = unicode(value)
    return pr    
 
#Create a gsaa specific legend class. For the legends that have the units embedded into the first line,
#we want to break that out and create a units field for the template to use.    
class gsaaLegend(esriLegendJSON):
  def getRestLegend(self, url, layerId):
    legendJSON =  esriLegendJSON.getRestLegend(self, url, layerId)
    if(legendJSON):
      label = legendJSON['legend'][0]['label']
      label, seperator, units = label.partition('(')
      #Clean the closing ')' from the string.
      if(len(units)):
        units = units[:units.rfind(')')]
        #Re-write the label with the units stripped out.
        legendJSON['legend'][0]['label'] = label
        #Add the units to the JSON
        legendJSON['units'] = units
      else:
        legendJSON['units'] = ""
        
    return(legendJSON)
      
class Layer(object):
  def __init__(self, logger = False):
    if(logger):
      self.logger = logging.getLogger(__name__)
    self.pk = None
    self.model = "data_manager.layer"
    self.layer_type = "" 
    self.fact_sheet = "" 
    self.themes = [] 
    self.topics = []
    self.compress_display = False 
    self.map_tiles = "" 
    self.legend_subtitle = "" 
    self.bookmark = "" 
    self.vector_graphic = "" 
    self.kml = "" 
    self.source = "" 
    self.lookup_table = [] 
    self.utfurl = "" 
    self.thumbnail = "" 
    self.data_download = "" 
    self.metadata = "" 
    self.opacity = 1.0 
    self.vector_color = "" 
    self.attribute_event = "" 
    self.description = "" 
    self.attribute_fields = [] 
    self.learn_more = "" 
    self.data_overview = "" 
    self.attribute_title = "" 
    self.is_sublayer = False 
    self.lookup_field = "" 
    self.legend = "" 
    self.data_status = "" 
    self.vector_fill = None 
    self.data_source = "" 
    self.data_notes = "" 
    self.name = "" 
    self.url = "" 
    self.arcgis_layers = "" 
    self.legend_title = "" 
    self.sublayers = []
    self.restName = ""
    self.slug_name = ""
    
  def buildLegendFile(self, legendDirectory, templateFilename, serverVersion):
    legendFilename = None    
    if(self.legend and len(self.legend)):      
      #templateFilename = 'soapLegendTplt.html'      
      legendQuery = gsaaLegend(serverVersion, True)
      arcLayerIds = [0]      
      if(len(self.arcgis_layers)):
        arcLayerIds = [int(x) for x in  self.arcgis_layers.split(',')]      
      legendData = legendQuery.getLegend(self.legend, arcLayerIds[0])
      if(self.logger):
        self.logger.debug("Legend data: %s" % (json.dumps(legendData)))
      legendTemplate = render_to_string(templateFilename, legendData)    
      if(legendTemplate):
        try:
          #CLean any unicode characters from the legend filename.
          cleanFilename = "".join(s for s in self.name if s in string.printable)
          legendFilename = "%s.html" % (cleanFilename)
          legendPath = "%s/%s" %(legendDirectory, legendFilename)                    
          self.logger.info("Opening legend file: %s" % (legendPath))
          with codecs.open(legendPath, mode="w", encoding="utf-8") as legendFile:
            legendFile.write(legendTemplate)
        except IOError,e:
          if(self.logger):
            self.logger.exception(e)
    else:
      self.logger.debug("No legend URL available.")
    
    return(legendFilename)
    
  def createLayerFromRest(self, 
                          topics, 
                          themeObj, 
                          lon, 
                          lat, 
                          restLayerInfo, 
                          description,
                          hoverDescription,
                          legendDirectory=None, 
                          legendURL=None, 
                          metadataURL=None,
                          subLayers=None, 
                          kmlLink = ""):
    
    self.topics = topics
    self.themes.append(themeObj.pk)
    if(len(self.name) == 0):
      self.name = restLayerInfo.__getattr__('name')
    
    self.slug_name = self.name.lower().replace(' ', '-')
    
    if(len(hoverDescription)):
      self.description = hoverDescription
    else:
      desc = restLayerInfo.__getattr__('description') 
      if(desc):
        self.description = desc

    if(len(description)):
      self.data_overview = description
    else:
      self.data_overview = self.description

    self.url = restLayerInfo.baseRestUrl + "/export"
    
    if(metadataURL):
      self.metadata = metadataURL
    else:
      self.metadata = restLayerInfo.restUrl

    self.learn_more = restLayerInfo.restUrl
    

    if 'name' in restLayerInfo:  
      self.restName = restLayerInfo['name']
    else:
      self.restName = self.name
      
    #elif 'mapName' in restLayerInfo:
      #self.restName = restLayerInfo['mapName']

    #if(len(self.name) == 0): 
    #  self.name = self.restName

    layerId = restLayerInfo.__getattr__('id')
    if(layerId != None):
      self.arcgis_layers = "%d" % (layerId)
      self.metadata + ("/" + self.arcgis_layers)
      
      
    #If we weren't provided a legend, check the version of the ESRI server, if it is 10 or higher, we can use the
    #REST legend parameter. We have to query the JSON then construct the legend since we cannot get the legend
    #for a single layer from the rest service, it returns them all.
    version = float(restLayerInfo.restService.__getattr__('currentVersion'))
    #version = 9.3
    if(self.logger):
      self.logger.debug("ESRI Version: %f" % (version))
    templateFile = None
    if(version >= 10.0):
      self.legend = "%s/legend?f=pjson" % (restLayerInfo.baseRestUrl)
      templateFile = 'restLegendTplt.html'
    else:
      self.legend = restLayerInfo.baseRestUrl.replace('/rest', '')
      templateFile = 'soapLegendTplt.html'
      self.logger.debug("Legend REST not supported.")
    if(legendDirectory):
      legendFilename = self.buildLegendFile(legendDirectory, templateFile, version)
      self.legend = "%s/%s" % (legendURL, legendFilename)
    
    if(len(kmlLink) == 0):
      if(layerId != None):
        #layerIds.append(layerId)    
        #Build the oddball way ESRI defines what layers go into the KML url.
        #l:ArrayIndexNumber=on
        #layers=comma delimeter list of array indexes
        on = "l:%d on" % (layerId)
        layers = "%d" % (layerId)
        #COnstruct KML link. If we don't have the layerid, the default is 0 which should be the parent node.
        self.kml = "%s/generatekml?docName=%s&%s&layers=%s&layerOptions=seperateImage" %\
                    (restLayerInfo.baseRestUrl, self.restName, on, layers)
    else:
      self.kml = kmlLink
    
    """
    if 'layers' in restLayerInfo:
      for index,layerNfo in enumerate(restLayerInfo.layers):
        layerIds.append(layerNfo['id'])
    elif 'subLayers'  in restLayerInfo:
      for index,layerNfo in enumerate(restLayerInfo.subLayers):
        layerIds.append(layerNfo['id'])    
    for index,id in enumerate(layerIds):
      if(len(on)):
        on += '&'
      on += "l:%d on" % (id)
      if(len(layers)):
        layers += ','
      layers += "%d" % (id)
    """     
  
    #Build the bookmark
    """   
    http://gsaaportal.org/visualize/
    &x=-77.00
    &y=30.80
    &z=6
    &dls[]=false  - layer active
    &dls[]=1      - layer opacity
    &dls[]=5      - layer id
    &basemap=ESRI+Ocean&themes[ids][]=0
    &tab=active
    &layers=true
    &legends=true
    
    self.bookmark = "/visualize/#x=%f&y=%f&z=%d&dls[]=true&dls[]=0.5&dls[]=%d&basemap=ESRI+Ocean&themes[ids][]=%d&tab=active&layers=true&legends=true"\
                  % (lon,lat,6,self.pk,themeObj.pk)
    """
    self.bookmark = "/visualize/#x=%f&y=%f&z=%d&dls[]=true&dls[]=0.5&dls[]=%d&basemap=ESRI+Ocean&themes[ids][]=%d&tab=active&layers=true&legends=true"\
                  % (-77.00,30.80,6,self.pk,themeObj.pk)
      
    
    return  
  
  def buildDict(self):
    pr = {}
    pr['fields'] = {}
    for name in dir(self):
      value = getattr(self, name)
      if not name.startswith('__') and not inspect.ismethod(value):
        if(name == 'restName' or name == 'logger'):
          continue
        if(name != 'pk' and name != 'model'):
          #print "%s: %s" % (name,value)
          pr['fields'][name] = value
        else:
          #print "%s: %s" % (name,value)
          pr[name] = value
    return pr    
  

#def main():
    #logging.config.fileConfig("/Users/danramage/Documents/workspace/GSAA/testingDebug.conf")
    #logger = logging.getLogger("gsaa_logger")
  
class Command(BaseCommand):
  args = '<input CSV File> <output JSON file> <Legend File Directory> <Legend Base URL> <Export Query Fields>'
  help = 'Input CSV File, Initial JSON file to write, Directory to write Legend Files must be we accessible, Base URL to access legend files., If provided, this is a directory to output a file per layer showing the query fields available.'

  def handle(self, *args, **options):
    logger = logging.getLogger(__name__)  
    logger.info("Begin CSVToInitialJson")
    inputCSVFile = args[0]
    outputJSONFile = args[1]
    legendDirectory = None
    legendsBaseURL = None
    if(len(args) > 2):
      legendDirectory = args[2]
      legendsBaseURL = args[3]
    
    queryFieldsOutDir = None  
    if(len(args) > 4):
      queryFieldsOutDir = args[4]
      
    initialData = []
    layerList = []
    themeList = []
    #topicList = []
    topicDict = {}
    attributeList = []
    try:
      #inputFile = codecs.open(inputCSVFile, mode='rU', encoding="utf-8")
      #dataFile = csv.DictReader(inputFile, fieldNames)
      inputFile = open(inputCSVFile, 'rU')
      dataFile = UnicodeDictReader(inputFile, fieldNames)      
      outFile = codecs.open(outputJSONFile, mode='w', encoding="utf-8")
      queryFile = None
      if(queryFieldsOutDir):
        queryFile = codecs.open("%s/query_fields.csv" % (queryFieldsOutDir), mode="w", encoding="utf-8")      
    except Exception, e:
      logger.exception(e)
    else:
      lon = -79.3
      lat = 33.4
      lineCnt = 0
      layerid = 0
      themeid = 0
      topicid = 0
      attributeid = 0
      for line in dataFile:
        logger.info("Processing line: %d" % (lineCnt))
        #if(lineCnt > 0):
        logger.debug("Layer: %s %s" % (line['DATA LAYER'], line['REST LAYER']))
        themeObj = None
        topics = []
          
        #A layer could be associated with one or more topics, so let's see what we have.
        topicNames = line['TOPICS'].split(',')          
        for index,topicName in enumerate(topicNames):
          if(len(topicName)):
            topicObj = None
            if(topicName in topicDict):
              topicObj = topicDict[topicName]
            else:
              logger.debug("Adding topic: %s" % (topicName))
              topicObj = Topic()
              topicObj.pk = topicid
              topicObj.name = topicName
              topicObj.display_name = topicName
              topicDict[topicName] = topicObj
              topicid += 1
            topics.append(topicObj.pk)
              
            
        for index,theme in enumerate(themeList):
          if(theme.display_name == line['MAIN THEME']):
            themeObj = theme
            break
        if(themeObj == None):
          logger.debug("Adding theme: %s" % (line['MAIN THEME']))
          themeObj = Theme()
          themeObj.pk = themeid
          themeObj.name = line['MAIN THEME'].replace(" ", "")
          themeObj.display_name = line['MAIN THEME']
          themeList.append(themeObj)
          themeid += 1
        
        layerObj = Layer(logger=True)
        layerList.append(layerObj)          
        
        layerObj.pk = layerid 
        layerid += 1
        if(len(line['DATA LAYER'])):
          layerObj.name = line['DATA LAYER'].strip()
        layerObj.data_notes = line["Comments"]
        layerObj.data_download = line["Raw Data Link"]
        layerObj.data_source = line["SOURCE"]
        layerObj.source = line["SOURCE URL"]

        #Parse the attributes for the layer and add them to the dictionary if we don't have it.
        attributeNames = line['Attributes'].split(',')
        attrDisplayNames = []
        if(len(line['Attributes Display Name'])):  
          attrDisplayNames = line['Attributes Display Name'].split(',')
        order = 1        
        attributeDict = None
        for index,attrName in enumerate(attributeNames):            
          if(len(attrName)):
            logger.debug("Adding attribute: %s" % (attrName))
            attrObj = AttributeInfo()
            attrObj.pk = attributeid
            attrObj.field_name = attrName
            if(len(attrDisplayNames)):
              attrObj.display_name = attrDisplayNames[index]
            else:
              attrObj.display_name = attrName
            attrObj.order = order;
            attributeList.append(attrObj)
            order += 1
            attributeid += 1
            
            #Add the attribute id to teh layer.
            layerObj.attribute_fields.append(attrObj.pk) 

                  
        #Build the metadata
        if(len(line['REST Endpoint'])):
          
          layerObj.layer_type = "ArcRest"
          
          restUrl = line['REST Endpoint']
          restArrayId = None
          logger.debug("Requesting rest JSON: %s" % (restUrl))
          if(len(line['REST Array Number'])):
            restArrayId = int(line['REST Array Number'])
            logger.debug("Rest Array ID: %d" % (restArrayId))
          esriRestEndpoint = restEndpoint(restUrl, restArrayId)
          if(esriRestEndpoint.queryRestJSON() == False):
            logger.error("Failed to retrieve endpoint data, skipping layer")
            continue
          else:
            layerObj.createLayerFromRest(topics, 
                                         themeObj, 
                                         lon, 
                                         lat, 
                                         esriRestEndpoint,
                                         line['Description'],
                                         line['Hover Description'], 
                                         legendDirectory, 
                                         legendsBaseURL, 
                                         line['local metadata url'],
                                         None,
                                         line['kml'])
            #Is this layer a sublayer of another?                            
            if(len(line['PARENT LAYER'])):
              parentLayerName = line['PARENT LAYER'].strip()
              logger.debug("Parent Layer is: %s" % (parentLayerName))
              parentLayer = None
              for layer in layerList:
                if(layer.name == parentLayerName):
                  parentLayer = layer
                  break
              if(parentLayer):
                parentLayer.layer_type = "checkbox"
                parentLayer.arcgis_layers = ""
                parentLayer.sublayers.append(layerObj.pk)
                layerObj.sublayers.append(parentLayer.pk)
                layerObj.is_sublayer = True
              else:
                logger.error("Unable to find parent layer: %s information." % (line['PARENT LAYER']))
            #layerid += 1
            
            if(queryFieldsOutDir):
              queryFields = esriRestEndpoint.__getattr__('fields')
              if(queryFields):
                names = []
                aliases = []
                ignoreList = ['FID', 'Shape', 'OBJECTID', 'OBJECTID_1']
                for field in queryFields:
                  if(field['name'] not in ignoreList):
                    names.append(field['name'])
                    aliases.append(field['alias'])
                queryFile.write("\"%s\",\"%s\",\"%s\"" % (layerObj.name,",".join(names),",".join(aliases)))  
                queryFile.write("\n")
              else:
                queryFile.write("Layer: %s\n" % (layerObj.name))
                  
        else:
          layerObj.layer_type = "placeholder"
          layerObj.themes.append(themeObj.pk)        
        lineCnt += 1
      
      inputFile.close()
      if(queryFile):
        queryFile.close()
        
      outFile.write("[\n")
      logger.info("Exporting topics to JSON")
      for topicName in topicDict:
        topicObj = topicDict[topicName]
        logger.debug("Name: %s" %(topicObj.name))
        outFile.write(json.dumps(topicObj.buildDict(), sort_keys=True, indent=4))
        outFile.write(",\n")
      logger.debug("Exporting themes to JSON")
      for index,theme in enumerate(themeList):
        logger.debug("Name: %s" %(theme.name))
        outFile.write(json.dumps(theme.buildDict(), sort_keys=True, indent=4))
        outFile.write(",\n")
      
      logger.info("Exporting attributes to JSON")
      for index,attr in enumerate(attributeList):
        logger.debug("Name: %s" %(attr.field_name))
        outFile.write(json.dumps(attr.buildDict(), sort_keys=True, indent=4))
        outFile.write(",\n")

      
      logger.debug("Exporting layers to JSON")
      for index,layer in enumerate(layerList):
        logger.debug("Name: %s" %(layer.name))
        layerDict = layer.buildDict()        
        outFile.write(json.dumps(layer.buildDict(), sort_keys=True, indent=4))
        if(index < len(layerList)-1):
          outFile.write(",")
        outFile.write("\n")
      outFile.write("]\n")
      outFile.close()
    
  

#if __name__ == '__main__':
#  main()
