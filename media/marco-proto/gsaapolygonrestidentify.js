OpenLayers.Control.GSAAPolygonRestIdentify = OpenLayers.Class(OpenLayers.Control.ArcGisRestIdentify, {

  themeModel : null,
  viewModel : null,
  layerModels : null,

  initialize: function(options)
  {
    this.layerModels = [];
    if(!('eventListeners' in options))
    {
      options.eventListeners =
      {
        arcfeatureidentify : this.arcfeatureidentify,
        idresultarrived :  this.idresultarrived
      }
    }
    //Call the base class initialize first.
    OpenLayers.Control.ArcGisRestIdentify.prototype.initialize.apply(this, arguments);
    this.outstandingQuery = false;

  },

  doQuery : function(evt)
  {
    this.outstandingQuery = true;

    for(var i = 0; i < this.layerModels.length; i++)
    {
      this.layerIds.push(this.layerModels[i].arcgislayers);
    }
    OpenLayers.Control.ArcGisRestIdentify.prototype.doQuery.apply(this, arguments);
  },
  cancelRequest : function()
  {
    this.themeModel.idCntrlQueriesOutstanding.remove(this.url);
    OpenLayers.Control.ArcGisRestIdentify.prototype.cancelRequest.apply(this, arguments);
  },
  arcfeatureidentify : function()
  {
    this.enableLayerDataAvailable(false);
  },
  enableLayerDataAvailable : function(enableFlag)
  {
    //For each layer model that makes up this request, let's set the layerDataAvailable false since we do not know if there is
    //data available in the queried polygon yet.
    for(var i = 0; i < this.layerModels.length; i++)
    {
      if(this.layerModels[i].parent)
      {
        this.layerModels[i].parent.layerDataAvailable(enableFlag);
      }
      this.layerModels[i].layerDataAvailable(enableFlag);
    }

  },

  idresultarrived : function(result)
  {
    var response = result.response;
    this.outstandingQuery = false;
    this.themeModel.idCntrlQueriesOutstanding.remove(this.url);

    if(response.status == 200)
    {
      var jsonFormat = new OpenLayers.Format.JSON();
      var returnJSON = {};
      try
      {
        returnJSON = jsonFormat.read(response.responseText);
      }
      catch(err)
      {
        returnJSON = {};
        var errMsg = "";
        errMsg += err;
        if('response' in result && 'responseText' in result.response)
        {
          errMsg += " " + result.response.responseText;
        }
        console.log(errMsg);
      }
      if('results' in returnJSON)
      {

        if(returnJSON['results'].length)
        {
          var self = this;
          //When multiple layer IDs are queried, one or more results for layer(s) can be returned. Loop through each result
          //to match the layerId with the layerModel, then set the layerDataAvailable accordingly.
          $.each(returnJSON['results'], function(index, resultObj) {
            $.each(self.layerModels, function(layerNdx, layerModel) {
              if(parseInt(layerModel.arcgislayers, 10) === resultObj.layerId)
              {
                if(layerModel.parent)
                {
                  layerModel.parent.layerDataAvailable(true);
                }
                layerModel.layerDataAvailable(true);
                return;
              }
            });
          });
        }
      }
      else
      {
        this.enableLayerDataAvailable(false);
      }
    }
    else
    {
      this.enableLayerDataAvailable(false);
    }
    //No outstanding queries, do the layer count.
    if(this.themeModel.idCntrlQueriesOutstanding().length == 0)
    {
      var layerAvail = 0;
      $.each(this.themeModel.layers(), function(ndx, layer)
      {
        if(layer.layerDataAvailable())
        {
          layerAvail += 1;
        }
      });
      this.themeModel.pgAvailableLayerDataCnt(layerAvail);
    }
  }
});
