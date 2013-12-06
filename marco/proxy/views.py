import httplib2
from urllib import urlencode
from urlparse import urlparse
from django.conf.urls.defaults import *
from django.conf import settings
from django.http import HttpResponse
import requests
import logging
import logging.config

requestTimeout = 30   #Set a timeout of N seconds to throw an exception if the server hasn't responded.

#PROXY_FORMAT = u"http://%s/%s" % (settings.PROXY_DOMAIN, u"%s")
allowedDomain = "gsaaportal.org"
def getLegendJSON(request, url):
    logger = logging.getLogger(__name__)
    logger.info("Begin getLegendJSON")
    #logger.debug("Request: %s" % (request))
    conn = httplib2.Http()
    # optionally provide authentication for server
    #conn.add_credentials('admin','admin-password')
    if request.method == "GET":

        getUrl = request.GET.get('url')
        logger.debug(getUrl)
        parsedURL = urlparse(getUrl)
        logger.info("URL: %s" % (getUrl))
        if(parsedURL.hostname == allowedDomain):
          try:
            results = requests.get(getUrl)
          except Exception,e:
            if(logger):
              logger.exception(e)
          else:
            if(results.status_code == 200):
              return HttpResponse(results.text)
            return(HttpResponse(''))
        else:
          logger.error("Illegal domain request attempt!")
          return(HttpResponse(status=403))

    elif request.method == "POST":
        parsedURL = urlparse(url)
        logger.info("URL: %s" % (url))
        if(parsedURL.hostname == allowedDomain):
          data = urlencode(request.POST)
          resp, content = conn.request(url, request.method, data)
          return HttpResponse(content)
        else:
          return(HttpResponse(status=403))

    return(HttpResponse('Request could not be processed.'))

def restQuery(request, url):
    logger = logging.getLogger(__name__)
    logger.info("Begin restQuery")
    #logger.debug("Request: %s" % (request))
    conn = httplib2.Http()
    # optionally provide authentication for server
    #conn.add_credentials('admin','admin-password')
    if request.method == "GET":

        getUrl = request.GET.get('url')
        logger.debug(getUrl)
        parsedURL = urlparse(getUrl)
        logger.info("URL: %s" % (getUrl))
        try:
          results = requests.get(getUrl, timeout=requestTimeout)
        except Exception,e:
          if(logger):
            logger.exception(e)
        else:
          if(results.status_code == 200):
            return HttpResponse(results.text)
          return(HttpResponse(''))

    elif request.method == "POST":
        parsedURL = urlparse(url)
        logger.info("URL: %s" % (url))
        data = urlencode(request.POST)
        resp, content = conn.request(url, request.method, data)
        return HttpResponse(content)

    return(HttpResponse('Request could not be processed.'))
