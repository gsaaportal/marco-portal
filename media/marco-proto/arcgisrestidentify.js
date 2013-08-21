OpenLayers.Control.ArcGisBaseRest = OpenLayers.Class(OpenLayers.Control, {
  f : 'json',
  geometry : null,
  geometryType: null,
  sr: 4326,
  EVENT_TYPES: ["resultarrived"],

  initialize: function(options) {
    this.EVENT_TYPES =
    OpenLayers.Control.ArcGisBaseRest .prototype.EVENT_TYPES.concat(
            OpenLayers.Control.prototype.EVENT_TYPES
    );
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
  }

});

OpenLayers.Control.ArcGisRestIdentify = OpenLayers.Class(OpenLayers.Control, {
        eventListeners:null,
        url:null,
        clickTolerance:0,
        EVENT_TYPES: ["resultarrived", "arcfeaturequery"],
        //Rest parameters
        layerid:null,
        time : null,
        layerTimeOptions : null,
        tolerance: 1,
        mapExtent: null,
        imageDisplay: null,
        returnGeometry: true,
        maxAllowableOffset: null,



        buildOptions: function(clickPosition,url){

                evtlonlat = this.map.getLonLatFromPixel(clickPosition);
                var spatialRel = "esriSpatialRelIntersects";
                var geometryType = "esriGeometryPoint";
                var geometry = evtlonlat.lon+","+evtlonlat.lat;
                //If there is a click tolerance, let's calculate an envelope to use to check for any results.
                if(this.clickTolerance > 0)
                {
                  var urXY = new OpenLayers.Pixel();
                  urXY.x = clickPosition.x + this.clickTolerance;
                  urXY.y = clickPosition.y + this.clickTolerance;
                  var urUR = this.map.getLonLatFromPixel(urXY);

                  var llXY = new OpenLayers.Pixel();
                  llXY.x = clickPosition.x - this.clickTolerance;
                  llXY.y = clickPosition.y - this.clickTolerance;
                  var llLL = this.map.getLonLatFromPixel(llXY);

                  geometryType = "esriGeometryEnvelope";
                  geometry = llLL.lon + "," + llLL.lat + "," + urUR.lon + "," + urUR.lat;
                }
                var queryoptions =
                {
                  geometry : geometry,
                  geometryType : geometryType,
                  inSR : this.sr,
                  outSR : this.sr,
                  spatialRel : spatialRel,
                  f : "json",
                  returnGeometry:"true",
                  outFields : this.outFields
                };

                var query = {
                        url:url,
                        headers: {"Content-type" : "application/json"},
                        params : queryoptions,
                        proxy: '/proxy/rest_query/?url=',
                        callback: function(request)
                        {
                          this.handleresult(request,clickPosition);
                        },
                        scope: this
                };
                return query
        },

        handleresult: function(result,xy){
                this.events.triggerEvent("resultarrived",{
                        text:result.responseText,
                        xy:xy
                });
        },

        request: function(clickPosition){
                queryOptions = this.buildOptions(clickPosition,this.url);
                var request = OpenLayers.Request.GET(queryOptions);
        },

        doQuery: function(e){
          this.events.triggerEvent("arcfeaturequery",{});
          this.request(e.xy);
        }
});
