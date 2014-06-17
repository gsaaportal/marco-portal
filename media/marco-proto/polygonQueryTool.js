(function() {
  var polygonQueryToolModel = function(viewModel)
  {
    var self = this;
    self.polygonOLControl = null;
    self.viewModel = viewModel;
    self.polygonQueryGeom = [];
    self.polygonSelectActive = ko.observable(false);
    self.currentPolygonFeature = null;

    self.initializeMapControl = function(map)
    {
      //Polygon query tool control
      //Set the style of the select polygon.
      var pgStyle = new OpenLayers.Style({
          //fillColor: '#FFFFFF',
          fillOpacity: 0,
          //strokeColor: '#0000d0',
          strokeOpacity: 0.5,
          strokeWidth: 2
      });
      var polygonLayer = new OpenLayers.Layer.Vector("Polygon Layer", {
                                                      styleMap : new OpenLayers.StyleMap({'default' : pgStyle})
        });
      //Add a vector layer to draw our polygon selection on for use with the "Does layer have data here" ESRI quesry.
      map.addLayer(polygonLayer);
      self.polygonOLControl = new OpenLayers.Control.DrawFeature(polygonLayer,
                                                            OpenLayers.Handler.Polygon,
                                                            {
                                                              featureAdded : self.selectionPolygonAdded,
                                                              callbacks : {
                                                                //We want to check to see if we're drawing a new polygon. If we are, let's get
                                                                //rid of the previous one from the screen.
                                                                point : function(point)
                                                                {
                                                                  //We have a polygon on the screen already, we're getting reading to create a new
                                                                  //one, so clear the old one.
                                                                  if(self.polygonQueryGeom && self.polygonQueryGeom.length)
                                                                  {
                                                                    //Cancel any outstanding queries.
                                                                    self.cancelPolygonQuery();
                                                                    //Remove the current polygon from the map.
                                                                    this.layer.removeAllFeatures();
                                                                    //Reset the polygon points array.
                                                                    self.polygonQueryGeom.length = 0;
                                                                  }
                                                                }

                                                              }

      });
      map.addControl(self.polygonOLControl);

    };
    self.polygonIdentify = function(event)
    {
      //Toggle the state.
      if(self.polygonSelectActive() === false)
      {
        self.enableControl(true);
      }
      else
      {
        self.enableControl(false);
      }
    };
    self.enableControl = function(enableFlag)
    {
      if(enableFlag)
      {
        self.polygonSelectActive(true);

        self.polygonOLControl.activate();
      }
      else
      {
        //Remove the current polygon from the map.
        self.polygonOLControl.layer.removeAllFeatures();
        //Reset the polygon points array.
        self.polygonQueryGeom.length = 0;

        self.polygonSelectActive(false);
        self.polygonOLControl.deactivate();
      }
    };

    self.selectionPolygonAdded = function(feature)
    {
      $('#polygonQueryTab').tab('show');

      var vertices = feature.geometry.getVertices();
      if(self.polygonQueryGeom)
      {
        self.polygonQueryGeom.length = 0;
      }
      else
      {
        self.polygonQueryGeom = [];
      }
      if(vertices.length)
      {
        for(var j = 0; j < vertices.length; j++)
        {
          var point = [];
          point.push(vertices[j].x);
          point.push(vertices[j].y);
          self.polygonQueryGeom.push(point);
        }
        var point = [];
        point.push(vertices[0].x);
        point.push(vertices[0].y);
        //Append the first point last to close the polygon.
        self.polygonQueryGeom.push(point);
      };

      for(var i = 0; i < self.viewModel.themes().length; i++)
      {
        //if(i === 0)
        //{
          var theme = self.viewModel.themes()[i];
          theme.doPolygonQuery(self.polygonQueryGeom, feature);
        //}
      }
    };
    //This aborts any outstanding queries from previous polygon query attempts.
    self.cancelPolygonQuery = function()
    {
      for(var i = 0; i < self.viewModel.themes().length; i++)
      {
        var theme = self.viewModel.themes()[i];
        $.each(theme.restIdentifyControls, function(ndx, restIdControl) {
            restIdControl.cancelRequest();
        });
      }
    };
  };
  app.viewModel.polygonQueryTool = new polygonQueryToolModel(app.viewModel);
})();
