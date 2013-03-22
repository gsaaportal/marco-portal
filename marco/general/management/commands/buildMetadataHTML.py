import codecs
from os import path
import logging
from lxml import etree
import requests
import csv
import string
from urlparse import urlparse

from django.template import Template
from django.template.loader import render_to_string
from django.core.management.base import BaseCommand, CommandError
from data_manager.models import *
from CSVToInitialJson import fieldNames

def UnicodeDictReader(utf8_data, fieldNames, **kwargs):    
    csv_reader = csv.DictReader(utf8_data, **kwargs)
    for row in csv_reader:
      yield dict([(key, unicode(value, 'utf-8')) for key, value in row.iteritems()])

def transform(xmlFile, xslPath):

  # read xsl file
  parser = etree.XMLParser(strip_cdata=False)
  xslRoot = etree.fromstring(open(xslPath).read(), parser)

  transform = etree.XSLT(xslRoot)
  

  # read xml
  xmlRoot = etree.fromstring(open(xmlFile).read(), parser)

  # transform xml with xslt
  transRoot = transform(xmlRoot)

  # return transformation result
  html = etree.tostring(transRoot)
  html = html.replace('&gt;', '>').replace('&lt;', '<')
  return html

class Command(BaseCommand):
  args = '<ControlFile> <xslFile> <sourceMetadata> <destinationHTML>'
  help = ''
  
  
  def handle(self, *args, **options):
    logger = logging.getLogger(__name__)  
    logger.info("Start buildMetadataHTML")
    if(len(args) < 5):
      logger.error("Required arguments not provided.")
      return

    controlFile = args[0] 
    xslFile = args[1]
    srcMetaDataFileDir = args[2]
    destHTMLDir = args[3]
    urlToLocalMetadata = args[4]
    """
    fieldNames = {
                  "REST LAYER" : 0,
                  "DATA LAYER" : 1,
                  "SOURCE" : 2,
                  "TOPICS" : 3,
                  "MAIN THEME" : 4,
                  "SubTheme" : 5,
                  "Raw Data Link" : 6,
                  "REST Endpoint" : 7,
                  "REST Array Number" : 8,
                  "REST Sublayer Array Numbers" : 9,
                  "source metadata url" : 10,
                  "local metadata url" : 11,
                  "Comments" : 12,
                  "Description" : 13,
                  "kml" : 14                  
                  }
    """
    
    #Run though the CSV control file and go out and get the metadata XML files for us to convert to HTML for the 
    #portal website.
    with codecs.open(controlFile, mode = 'r', encoding='utf-8') as csvSrcFile:
    #with open(controlFile, 'rU') as csvSrcFile:
      #As we write the local metadata file, we want to add the full url of the local metadata file to the control
      #file.
      #dataFile = csv.DictReader(csvSrcFile, fieldNames)
      try:
        dataFile = UnicodeDictReader(csvSrcFile, fieldNames)
      except Exception,e:
        logger.exception(e)
      destControlFile = "%s/controlFile.csv" % (path.dirname(controlFile)) 
      logger.debug("Opening new control file with local metadata url: %s" % (destControlFile))
      with codecs.open(destControlFile, mode = 'w', encoding = 'utf-8') as destControlFile:
        lineNum = 0
        for line in dataFile:
          logger.debug("Processing line: %d" % (lineNum))
          logger.debug("Line: %s" % (line))
          if(lineNum >= 0):
            logger.debug("Processing layer: %s" % (line["REST LAYER"]))
            logger.debug("Requesting metadata URL: %s" % (line['source metadata url']))
            if(len(line['source metadata url'])):
              try:
                #req = requests.get(line[fieldNames['source metadata url']])
                req = requests.get(line['source metadata url'])
              except Exception,e:
                logger.exception(e)
              else:
                if(req.status_code == 200):
                  
                  htmlMetadata = None
                  #We want a filename clear of any unicode are non-printable characters.
                  """
                  if(len(line["DATA LAYER"])):
                    cleanFilename = "".join(s for s in line["DATA LAYER"] if s in string.printable)
                  else:
                    cleanFilename = "".join(s for s in line["REST LAYER"] if s in string.printable)
                  """
                  parsedUrl = urlparse(line['source metadata url']) 
                  #Get the path from the url, split it into parts based on the '/', then split up the filename from the extension. 
                  fileName,seperator,extension = parsedUrl.path.split('/')[-1].partition('.')
                  cleanFilename = "".join(s for s in fileName if s in string.printable)
                  
                  
                  contentType = req.headers['content-type'].split(';')
                  
                  logger.info("Content type of request: %s" %(req.headers['content-type']))
                  
                  #Check the content-type, if its XML we need to transform it.
                  if(contentType[0] == 'text/xml' or contentType[0] == 'application/xml'):     
                    xmlFilename = "%s/%s.xml" % (srcMetaDataFileDir, cleanFilename)
                    logger.info("Saving XML source file: %s" % (xmlFilename))
                    try:
                      with codecs.open(xmlFilename, mode = 'w', encoding = 'utf-8') as xmlFile:
                        xmlFile.write(req.text) 
                      htmlMetadata = transform(xmlFilename, xslFile)
                    except IOError,e:
                      logger.exception(e)
                    except Exception,e:
                      logger.exception(e)
                      
                  elif(contentType[0] == 'text/html' or contentType[0] == 'application/html'):
                    htmlMetadata = None
                    line['local metadata url'] = line['source metadata url']
                    
                  if(htmlMetadata):
                    #Save html data to file for use in the portal.
                    htmlFilename = "%s/%s.html" % (destHTMLDir, cleanFilename)
                    logger.info("Saving HTML metadata file: %s" % (htmlFilename))
                    try:
                      with codecs.open(htmlFilename, mode='w', encoding='utf-8') as htmlFile:
                        htmlFile.write(htmlMetadata)                        
                      line['local metadata url'] = "%s/%s.html" % (urlToLocalMetadata, cleanFilename)
                      logger.debug("Local metadata url: %s" % (line['local metadata url']))
                    except IOError,e:
                      logger.exception(e)
                    except Exception,e:
                      logger.exception(e)

                  else:
                    logger.error("No metadata available.")
                  
            else:
              logger.error("No metadata link.")
          try:
            outBuf = ''
            hdrBuf = ''
            for key in fieldNames:
              if(lineNum == 0):
                if(len(hdrBuf)):
                  hdrBuf += ','
                hdrBuf += key
              if(len(outBuf)):
                outBuf += ','
              outBuf += '\"%s\"' % (str(line[key])) 
            #outBuf = '%s' % ','.join(str(x) for x in line.values())
          
            if(len(hdrBuf)):
              destControlFile.write(hdrBuf + '\n')                                  
            destControlFile.write(outBuf + '\n')                    

          except Exception,e:
            logger.exception(e)

          lineNum += 1

    """
    xmlMetadataList =  [ f for f in listdir(srcMetaDataFileDir) if isfile(join(srcMetaDataFileDir,f)) ]
    
    for xmlFile in xmlMetadataList:
      logger.info("Tranforming XML file: %s" % (xmlFile))
      xmlFilename, fileExtension = path.splitext(xmlFile)
      htmlFilename = "%s/%s.html" % (destHTMLDir, xmlFilename)
      logger.info("Opening HTML file: %s" % (htmlFilename))
      try:
        with open(htmlFilename, "w") as htmlOutfile:
          htmlMetadata = transform(srcMetaDataFileDir + '/' + xmlFile, xslFile)
          htmlOutfile.write(htmlMetadata)
      except IOError,e:
        logger.exception(e)
    """                      
                          