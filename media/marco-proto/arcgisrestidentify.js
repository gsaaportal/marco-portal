OpenLayers.Control.ArcGisBaseRest = OpenLayers.Class(OpenLayers.Control, {
  //URL for the REST request.
  url : null,
  proxy : null,
  handler : null,

  //Rest parameters, descriptions taken from the ESRI API pages:http://help.arcgis.com/en/arcgisserver/10.0/apis/rest/
  //Required
  //The geometry to apply as the spatial filter.
  //The structure of the geometry is the same as the structure of the json geometry objects returned by the ArcGIS REST API.
  //In addition to the JSON structures, for envelopes and points, you can specify the geometry with a simpler comma-separated syntax.
  geometry : "0,0",

  // The response format. The default response format is json. Depeding on the type of request it can be: html, json, kmz, amf.
  f : 'json',

  //The type of geometry specified by the geometry parameter.
  //The geometry type can be an envelope, point, line, or polygon.
  geometryType : null,

  EVENT_TYPES : ["resultarrived"],

  initialize: function(options) {
    OpenLayers.Control.prototype.initialize.apply(
            this, arguments
    );
  },

  activate: function () {
    if (!this.active) {
            this.handler.activate();
    }
    return OpenLayers.Control.prototype.activate.apply(
            this, arguments
    );
  },

  deactivate: function () {
    return OpenLayers.Control.prototype.deactivate.apply(
            this, arguments
    );
  },

});

OpenLayers.Control.ArcGisRestIdentify = OpenLayers.Class(OpenLayers.Control, {
  eventListeners:null,
  freehand : true,

  layerIds: null,

  //We can ask for top, visible, all, see layers description below.
  layersToId : 'all',

  url : null,
  proxy : null,
  handler : null,

  //resultarrived is the event fired when the server has returned the query requests. This will contain the data queried.
  //arcfeatureidentify is the event fired when the server request is about to be made. This can be used to display a loading indicator
  // or do any other pre-query preperations.
  EVENT_TYPES : ["idresultarrived","arcfeatureidentify"],

  //Rest parameters, descriptions taken from the ESRI API pages:http://help.arcgis.com/en/arcgisserver/10.0/apis/rest/
  //Required
  //The geometry to apply as the spatial filter.
  //The structure of the geometry is the same as the structure of the json geometry objects returned by the ArcGIS REST API.
  //In addition to the JSON structures, for envelopes and points, you can specify the geometry with a simpler comma-separated syntax.
  geometry : "0,0",

  // The response format. The default response format is json. Depeding on the type of request it can be: html, json, kmz, amf.
  f : 'json',

  //The type of geometry specified by the geometry parameter.
  //The geometry type can be an envelope, point, line, or polygon.
  geometryType : null,

  defaultHandlerOptions :
  {
    freehand : true,
  },
  //Rest parameters, descriptions taken from the ESRI API pages:http://help.arcgis.com/en/arcgisserver/10.0/apis/rest/

  //Required
  //The extent or bounding box of the map currently being viewed.
  //Unless the sr parameter has been specified, the mapExtent is assumed to be in the spatial reference of the map.
  mapExtent: null,

  //Required
  //The screen image display parameters (width, height and DPI) of the map being currently viewed.
  imageDisplay: null,

  //Required
  //The distance in screen pixels from the specified geometry within which the identify should be performed.
  //The value for the tolerance is an integer.
  tolerance:0,

  //The layers to perform the identify operation on. There are three ways to specify which layers to identify on:
  //top: Only the top-most layer at the specified location.
  //visible: All visible layers at the specified location.
  //all: All layers at the specified location.

  layers: null,

  //The well-known ID of the spatial reference of the input and output geometries as well as the mapExtent.
  //If sr is not specified, the geometry and the mapExtent are assumed to be in the spatial reference of the map,
  //and the output geometries are also in the spatial reference of the map.
  sr: 4326,

  // Allows you to filter the features of individual layers in the exported map by specifying definition expressions for those layers.
  //Definition expression for a layer that is published with the service will be always honored.
  layerDefs : null,


  //The time instant or the time extent of the features to be identified.
  time : null,

  //The time options per layer.
  //Users can indicate whether or not the layer should use the time extent specified by the time parameter or not,
  //whether to draw the layer features cumulatively or not and the time offsets for the layer.
  layerTimeOptions : null,

  //If true, the resultset will include the geometries associated with each result. The default is true.
  returnGeometry: true,

  // This option can be used to specify the maximum allowable offset to be used for generalizing geometries returned by the identify operation.
  //The maxAllowableOffset is in the units of the sr.
  //If sr is not specified then maxAllowableOffset is assumed to be in the unit of the spatial reference of the map.
  maxAllowableOffset: null,


  initialize: function(options)
  {
    this.currentRqst = null;
    this.layerIds = [];
    //Call the base class initialize first.
    OpenLayers.Control.prototype.initialize.apply(
            this, arguments
    );
    if(this.geometryType == null)
    {
      this.geometryType = "esriGeometryPolygon";
    }
    this.defaultHandlerOptions.freehand = options.freehand;
    this.handlerOptions = OpenLayers.Util.extend(
            {}, this.defaultHandlerOptions
    );
    //Event gets triggered when the query begins. Handle it to throw up a loading indicator and do other prep work for when the
    //result arrives.
    //this.EVENT_TYPES.push("arcfeatureidentify");

    //Register the doQuery function to handle the 'done' event fired when the user has completed drawing the polygon.
    var callbacks = {};
    callbacks['done'] = this.doQuery;
    this.handler = new OpenLayers.Handler.Polygon(
            this,
            callbacks,
            this.handlerOptions
    );
  },

  activate: function () {
    if (!this.active) {
            this.handler.activate();
    }
    return OpenLayers.Control.prototype.activate.apply(
            this, arguments
    );
  },

  deactivate: function () {
    return OpenLayers.Control.prototype.deactivate.apply(
            this, arguments
    );
  },

  buildOptions: function()
  {
    var geometry;
    if(this.geometryType == 'esriGeometryPolygon')
    {
      geometry = {rings : []};

      geometry['rings'].push(this.geometry);

      geometry = JSON.stringify(geometry);
    }
    else
    {
      geometry = this.geometry.join();
    }

    var queryoptions =
    {
      layers        : this.layersToId + ":" + this.layerIds.join(),
      geometry      : geometry,
      geometryType  : this.geometryType,
      sr            : this.sr,
      imageDisplay  : this.imageDisplay,
      mapExtent     : this.mapExtent,
      f             : this.f,
      returnGeometry: this.returnGeometry,
      tolerance     : this.tolerance
    };


    var query = {
            url: this.url,
            params : queryoptions,
            async: true,
            proxy: this.proxy,
            callback: function(request)
            {
              this.handleresult(request);
            },
            scope: this
    };
    return query
  },

  request: function(evt)
  {
    queryOptions = this.buildOptions();
    //var request = OpenLayers.Request.GET(queryOptions);
    this.currentRqst = OpenLayers.Request.GET(queryOptions);
  },

  doQuery: function(evt)
  {
    this.events.triggerEvent("arcfeatureidentify",evt);
    this.request(evt);
  },

  cancelRequest : function()
  {
    if(this.currentRqst)
    {
      this.currentRqst.abort();
      //this.currentRqst = null;
    }
  },

  handleresult: function(result)
  {
    this.events.triggerEvent("idresultarrived",
    {
      response : result
    });
    //this.currentRqst = null;
  },

});
