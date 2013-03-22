import httplib2
from urllib import urlencode
from django.conf.urls.defaults import *
from django.conf import settings
from django.http import HttpResponse
import requests
import simplejson as json
import logging
import codecs
import csv

from CSVToInitialJson import Layer as myLayer
from esriRest import restEndpoint

from data_manager.models import Layer
from django.template import Template
from django.template.loader import render_to_string
from django.core.management.base import BaseCommand, CommandError



class Command(BaseCommand):
  args = '<legenddirectory>'
  help = ' <legenddirectory> is the directory to write the HTML legend files.'
  
  
  def handle(self, *args, **options):
    legendOutputDir = args[0]  
    logger = logging.getLogger(__name__)
    logger.info("Begin buildRestLegends")  
    #Get all the REST layers from the database.
    for layer in Layer.objects.filter(layer_type ='ArcRest').exclude(layer_type='placeholder').order_by('name'):
      
      #for topic in layer.topics.all():
      #  logger.debug("Topic: %s" % (topic.name))
      arrayId = None
      logger.info("Layer: %s(%s)" % (layer.name,layer.arcgis_layers))
      #There could be multiple IDs, at the moment just deal with 1.
      if(len(layer.arcgis_layers)):
        indexIds = [int(x) for x in  layer.arcgis_layers.split(',')]
        arrayId = indexIds[0]
      baseRestUrl,sep,remain = layer.url.partition('/export')
      esriRestEndpoint = restEndpoint(baseRestUrl, arrayId)
      if(esriRestEndpoint.queryServiceJSON()):
        version = float(esriRestEndpoint.restService.__getattr__('currentVersion'))
        #version = 9.3
        logger.debug("ESRI Version: %f URL: %s" % (version, baseRestUrl))
        layerObj = myLayer(True)
        layerObj.name = layer.name
        layerObj.arcgis_layers = layer.arcgis_layers
        #Verify the ESRI service version is above 10.0 and can do REST legends.
        if(version >= 10.0):
          layerObj.legend = "%s/legend?f=pjson" % (baseRestUrl)
          templateFile = 'restLegendTplt.html'
        else:
          templateFile = 'soapLegendTplt.html'
          #Build SOAP Legend URL
          layerObj.legend = baseRestUrl.replace('/rest', '')
        if(legendOutputDir):
          legendFilename = layerObj.buildLegendFile(legendOutputDir, templateFile, version)
                        
    logger.info("End buildRestLegends")  
  
#if __name__ == '__main__':
#  main()
