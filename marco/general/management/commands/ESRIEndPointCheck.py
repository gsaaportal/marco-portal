import csv
from multiprocessing import Lock, Process, Queue, current_process
import optparse
import time
from esriRest import *
import traceback
from os.path import splitext
from utils import smtpClass

class layerTestResult(object):
  def __init__(self, **kwargs):
    self.index = None
    if('index' in kwargs):
      self.index = kwargs['index']

    self.localLayerName = None
    if('localLayerName' in kwargs):
      self.localLayerName = kwargs['localLayerName']

    self.remoteLayerName = None
    if('remoteLayerName' in kwargs):
      self.remoteLayerName = kwargs['remoteLayerName']

    self.url = None
    if('url' in kwargs):
      self.url = kwargs['url']

    self.esirIndex = None
    if('esirIndex' in kwargs):
      self.esirIndex = kwargs['esirIndex']

    self.responseTime = None
    if('responseTime' in kwargs):
      self.responseTime = kwargs['responseTime']

    self.error = None
    if('error' in kwargs):
      self.error = kwargs['error']

    self.exception = None
    if('exception' in kwargs):
      self.exception = kwargs['exception']

  def __str__(self):
    ndx = ""
    if(self.esirIndex):
      ndx = self.esirIndex
    elapsed = ""
    if(self.responseTime):
      elapsed = "Response Time: %s " % (self.responseTime)
    outBuf = "URL: %s/%s Local layer: %s %s" % (self.url, ndx, self.localLayerName, elapsed)
    if(self.remoteLayerName):
      outBuf += "Remote: %s." % (self.remoteLayerName)
    else:
      if(self.error):
        outBuf += "Error: %s." % (self.error)
      if(self.exception):
        outBuf += "Exception: %s." % (self.exception)

    return outBuf

def wrapCheckLayer(inputQueue, resultQueue):
  print "%s starting wrapCheckLayer." % (current_process().name)
  try:
    checkLayer(inputQueue, resultQueue)
  except:
    print('%s: %s' % (current_process().name, traceback.format_exc()))
  print "%s ending wrapCheckLayer." % (current_process().name)

  return True

def checkLayer(inputQueue, resultQueue):
  print "%s starting checkLayer." % (current_process().name)
  for row in iter(inputQueue.get, 'STOP'):
    result = None
    localName = row[0]
    try:
      if(len(row[1])):
        esriRestEndpoint = restEndpoint(row[1], row[2], False)
        print "%s querying enpoint: %s Index: %s" % (current_process().name, row[1], row[2])

        if(esriRestEndpoint.queryRestJSON()):
          responseTime = None
          if hasattr(esriRestEndpoint.results, 'elapsed'):
            responseTime = esriRestEndpoint.results.elapsed

          if('error' not in esriRestEndpoint):
            remoteName = esriRestEndpoint.__getattr__('name')
            if(remoteName and remoteName.strip() != localName.strip()):
              result = layerTestResult(index=row[3],
                                       localLayerName=localName,
                                       url=row[1],
                                       esriIndex=row[2],
                                       remoteLayerName=remoteName,
                                       responseTime=responseTime)
          else:
            result = layerTestResult(index=row[3],
                                     localLayerName=localName,
                                     url=row[1],
                                     esriIndex=row[2],
                                     error=esriRestEndpoint['error'],
                                     responseTime=responseTime)
        else:
          errorStr = "Query failed. Code: %d Reason: %s"\
                     % (esriRestEndpoint.results.status_code, esriRestEndpoint.results.reason)
          result = layerTestResult(index=row[3],
                                   localLayerName=localName,
                                   url=row[1],
                                   esriIndex=row[2],
                                   error=errorStr,
                                   responseTime=responseTime)
    except Exception,e:
      print('%s exception occurred %s' % (current_process().name, traceback.format_exc(1)))
      result = layerTestResult(index=row[3],
                               localLayerName=localName,
                               url=row[1],
                               esriIndex=row[2],
                               exception=traceback.format_exc(1))

    if(result):
      resultQueue.put(result)

  print "%s ending checkLayer" % (current_process().name)

  return True


def writeCorrectedFile(inputFileName, resultsList):
  try:
    inFile = open(inputFileName, 'rU')
    parts = splitext(inputFileName)
    newOutFile = parts[0] + '-corrected.csv'
    outFile = open(newOutFile, "w")
  except IOError,e:
    traceback.print_exc(e)
  else:
    try:
      csvReader = csv.reader(inFile)
      rowNum = 0
      for row in csvReader:
        #First line is header.
        if(rowNum >0):
          match = False
          for result in resultsList:
            if(rowNum == result['index'] and 'remoteLayerName' in result):
              if('remoteLayerName' in result and result['remoteLayerName']):
                match = True
                break
          if(match):
            outLine = "\"%s\",%s,%s" % (result['remoteLayerName'], result['url'], result['esriIndex'])
          else:
            outLine = "\"%s\",%s,%s" % (row[0],row[1],row[2])
            #outLine = ",".join(row)
          outFile.write(outLine + '\n')
        else:
          outFile.write("REST LAYER,REST Endpoint,REST Array Number\n")
        rowNum += 1
    except Exception,e:
      traceback.print_exc(e)
    finally:
      inFile.close()
      outFile.close()

def emailResults(body, toList, emailServer, fromAddr, emailPwd):

  subject =  "[GSAA] ESRI Endpoint Check"
  smtp = smtpClass(emailServer, fromAddr, emailPwd)
  smtp.from_addr("%s@%s" % (fromAddr,emailServer))
  smtp.rcpt_to(toList)
  smtp.subject(subject)
  smtp.message(body)
  smtp.send()


  return


def main():
  parser = optparse.OptionParser()
  parser.add_option("-i", "--InputFile", dest="inputFile",
                    help="CSV file with ESRI endpoints to test. SHould have 3 columns: Layer Name to check, URL, Index." )
  parser.add_option("-f", "--EmailFrom", dest="emailFrom",
                    help="If emailing results, this is the user name for the SMTP server the email is from." )
  parser.add_option("-s", "--EmailServer", dest="emailServer",
                    help="SMTP server address used to send the email." )
  parser.add_option("-p", "--EmailPassword", dest="emailPwd",
                    help="Password for the email server user." )
  parser.add_option("-t", "--ToList", dest="toList",
                    help="Comma delimited list of email address to send the results to." )
  parser.add_option("-c", "--WriteCorrectedCSV", dest="writeCorrected", action="store_true",
                    help="If set, this will write a new CSV similar to the input file with the remote layer names used as the first column. File uses inputFile name with -corrected appended." )
  (options, args) = parser.parse_args()
  if not options.inputFile:
    print("InputFile is a required option.")
    parser.print_help()
  sendEmail = False
  if(options.emailServer and options.emailFrom and options.toList and options.emailPwd):
    sendEmail = True

  try:
    inFile = open(options.inputFile, 'rU')
  except IOError,e:
    traceback.print_exc(e)
  else:
    workers = 4
    inputQueue = Queue()
    resultQueue = Queue()
    finalResults = []
    processes = []

    try:
      csvReader = csv.reader(inFile)
      rowNum = 0
      for row in csvReader:
        #First line is header.
        if(rowNum >0):
          #Add line count to have something we can sort by later on.
          row.append(rowNum)
          inputQueue.put(row)
        rowNum += 1
    finally:
      inFile.close()

    #Start up the worker processes.
    for workerNum in xrange(workers):
      p = Process(target=wrapCheckLayer, args=(inputQueue, resultQueue))
      print("Starting process: %s" % (p._name))
      p.start()
      processes.append(p)
      inputQueue.put('STOP')


    #If we don't empty the resultQueue periodically, the .join() below would block continously.
    #See docs: http://docs.python.org/2/library/multiprocessing.html#multiprocessing-programming
    #the blurb on Joining processes that use queues
    while any([checkJob.is_alive() for checkJob in processes]):
      if(resultQueue.empty() == False):
        finalResults.append(resultQueue.get())
      time.sleep(0.5)

    #Wait for the process to finish.
    for p in processes:
      p.join()

    #Poll the queue once more to get any remaining records.
    while(resultQueue.empty() == False):
      finalResults.append(resultQueue.get())

    #Flag specifies we want to create a new file with the corrected ESRI layer names.
    if(options.writeCorrected):
      writeCorrectedFile(options.inputFile, finalResults)


    diffList = []
    errorList = []
    for result in finalResults:
      if(result.remoteLayerName):
        diffList.append(str(result))
      else:
        errorList.append(str(result))

    body = "The following local layer names did not match the remote ESRI layer names.\n"
    if(len(diffList)):
      body += "\n".join(diffList)
    else:
      body += "All local layer names match remote layer names."
    body += "\n\nThe following local layers resulted in an error or exception when querying the remote ESRI layer.\n"
    if(len(errorList)):
      body += "\n".join(errorList)
    else:
      body += "No errors or exceptions."


    if(sendEmail):
      emailResults(body, options.toList.split(","), options.emailServer, options.emailFrom, options.emailPwd)
    else:
      print body

  return

if __name__ == '__main__':
  main()