import simplejson as json
import requests
from urlparse import urlparse
import logging
import xmltodict
import codecs

requestTimeout = 30

class esriRest(dict):
  def __init__(self, restUrl, logger=True):
    self.restUrl = restUrl
    self.logger = None
    self.results = None
    if(logger):
      self.logger = logging.getLogger(__name__)
    dict.__init__(self, {})
    
  def queryRestJSON(self):
    params = {'f' : 'pjson'}
    if(self.logger):
      self.logger.debug("Query REST JSON data: %s" % (self.restUrl))
    try:
      self.queryRestData(self.restUrl, params)
    except Exception,e:
      if(self.logger):
        self.logger.exception(e)
      raise
    else:
      if(self.results and self.results.status_code == 200):
        dict.__init__(self, json.loads(self.results.text))
        return(True)
      else:
        if(self.logger):
          self.logger.error("Query failed. Code: %d Reason: %s" % (self.results.status_code, self.results.reason))
    return(False)
    
  def queryRestData(self, url, params):
    self.results = requests.get(url, params=params, timeout=requestTimeout)
    return(self.results)

  def __getattr__(self, item):
    if(item in self):
      return(self[item])
    else:
      return(None)
"""    
class restService(esriRest):
    
  def getVersion(self):
    self.__getattr__('currentVersion')
"""    
class restEndpoint(esriRest):
  def __init__(self, restLayerUrl, layerId, logger=True):
    self.baseRestUrl = restLayerUrl
    if(layerId):
      restLayerUrl = "%s/%s" % (restLayerUrl, layerId)
      
    esriRest.__init__(self, restLayerUrl, logger)  
    self.layerId = layerId
    
    self.restService = None
    
  def queryServiceJSON(self):
    urlParts = urlparse(self.restUrl)
    #build the services url so we can find out the version we are working with.
    pathParts = urlParts[2].split('/')
    serviceUrl = ('http://' + urlParts[1])                            
    for part in pathParts:
      serviceUrl += ('/' + part)
      if(part == 'services'):
        break          
    self.restService = esriRest(serviceUrl)
    return(self.restService.queryRestJSON())
    
  def queryRestJSON(self):
    if(esriRest.queryRestJSON(self)):
      self.queryServiceJSON()
      return(True)
    return(False)


class esriLegendJSON(object):
  def __init__(self, serverVersionNumber, logger=False):
    self.version = serverVersionNumber
    self.logger = None
    if(logger):
      self.logger = logging.getLogger(__name__)

  def getRestLegend(self, url, layerId):
    legendJSON = None
    try:    
      if(self.logger):
         self.logger.debug("Querying REST legend at: %s LayerId: %d" % (url, layerId))      
      results = requests.get(url)
    except Exception,e:
      if(self.logger):
        self.logger.exception(e)
    else:
      if(results.status_code == 200):     
        if(self.logger):
          self.logger.debug("Request successful")     
        jsonData = json.loads(results.text)
        if "error" in jsonData:
          if(self.logger):
            self.logger.error("Error getting legend. Code: %d Msg: %s" % (jsonData['error']['code'], jsonData['error']['message']))
        else:          
          for legend in jsonData['layers']:
            if(legend['layerId'] == layerId):
              legendJSON = legend
              break
      else:
        if(self.logger):
          self.logger.error("Request failed.")  
    return(legendJSON)
  
  def getDefaultMapName(self, url):
    mapName = None
    headers = { 'Content-Type' : 'text/xml',
                'SOAPAction' : ""}
    soapXML = """<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <soapenv:Body>
      <GetDefaultMapName>      
      </GetDefaultMapName>      
      </soapenv:Body>
      </soapenv:Envelope>"""
    if(self.logger):
       self.logger.debug("Quering SOAP map name at: %s" % (url))
    try:
      req = requests.post(url, 
                          headers=headers, 
                          data=soapXML)
    except Exception,e:
      if(self.logger):
        self.logger.exception(e)
    else:
      if(req.status_code == 200):
        xmlDict = xmltodict.parse(req.text)
        if('soap:Fault' in xmlDict['soap:Envelope']['soap:Body']):
          if(self.logger):
            self.logger.error("Soap Error: %s" % (json.dumps(xmlDict)))
        else:
          mapName = xmlDict['soap:Envelope']['soap:Body']['tns:GetDefaultMapNameResponse']['Result']
                    
    return(mapName)
      
  def getSoapLegend(self, url, layerId):
    mapName = self.getDefaultMapName(url)
    if(mapName):
      legendJSON = None
      soapXML = """<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <soapenv:Body>
        <GetLegendInfo xmlns="http://www.esri.com/schemas/ArcGIS/%f">
        <MapName>%s</MapName>
        <LayerIDs/>
        <LegendPatch>
        <Width>20.0</Width><Height>20.0</Height>
        <ImageDPI>96.0</ImageDPI>
        </LegendPatch>
        <ImageType>
        <ImageFormat>esriImagePNG</ImageFormat>
        <ImageReturnType>esriImageReturnMimeData</ImageReturnType>
        </ImageType>
        </GetLegendInfo>
        </soapenv:Body>
        </soapenv:Envelope>""" % (self.version,mapName)
      headers = { 'Content-Type' : 'text/xml',
                  'SOAPAction' : ""}
      if(self.logger):
         self.logger.debug("Quering SOAP legend at: %s for layerId: %d" % (url, layerId))
      try:
        req = requests.post(url, 
                            headers=headers, 
                            data=soapXML)
      except Exception,e:
        if(self.logger):
          self.logger.exception(e)
      else:
        if(req.status_code == 200):
          encoder = codecs.getencoder('utf-8')
          decodedText = encoder(req.text, 'replace')
          #Now let's convert the XML into a dictionary and process it to mimic the REST Legend JSON.
          xmlDict = xmltodict.parse(decodedText[0])
          if(self.logger):
            self.logger.debug("XML-JSON Legend: %s" % (json.dumps(xmlDict)))
          if('soap:Fault' in xmlDict['soap:Envelope']['soap:Body']):
            if(self.logger):
              self.logger.error("Soap Error: %s" % (json.dumps(xmlDict)))
          else:
            #This is supposed to be an array, however if there is only 1 element the xmltodict does not decode
            #properly, so this is a fix.
            if('MapServerLegendInfo' in xmlDict['soap:Envelope']['soap:Body']['tns:GetLegendInfoResponse']['Result']):
                
              if( type(xmlDict['soap:Envelope']['soap:Body']['tns:GetLegendInfoResponse']['Result']['MapServerLegendInfo']) != list):
                legendInfo = xmlDict['soap:Envelope']['soap:Body']['tns:GetLegendInfoResponse']['Result']['MapServerLegendInfo']
                xmlDict['soap:Envelope']['soap:Body']['tns:GetLegendInfoResponse']['Result']['MapServerLegendInfo'] = [legendInfo]
      
              #Find the matching layer id.
              for legend in xmlDict['soap:Envelope']['soap:Body']['tns:GetLegendInfoResponse']['Result']['MapServerLegendInfo']:
                if(int(legend['LayerID']) == layerId):
                  legendJSON = legend
                  break
                            
              if(legendJSON and type(legendJSON['LegendGroups']['MapServerLegendGroup']['LegendClasses']['MapServerLegendClass']) != list):
                legendClass = legendJSON['LegendGroups']['MapServerLegendGroup']['LegendClasses']['MapServerLegendClass']
                legendJSON['LegendGroups']['MapServerLegendGroup']['LegendClasses']['MapServerLegendClass'] = [legendClass]
            
        else:
          if(self.logger):
            self.logger.error(req.text)
        return(legendJSON)
      
  def getLegend(self, url, layerId):
    if(self.logger):
      self.logger.debug("Requesting legend URL: %s" % (url))
    legendData = None
    #Use the REST legend interface
    if(self.version >= 10.0):
      legendData = self.getRestLegend(url, layerId)      
    #otherwise, let's try the SOAP interface.
    else:
      legendData = self.getSoapLegend(url, layerId)
    return(legendData)
    
    