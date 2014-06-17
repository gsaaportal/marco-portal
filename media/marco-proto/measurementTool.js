
//function measureToolModel() {
(function() {
var measureToolModel = function() {
  var self = this;

  self.measureOLTool = null;
  self.feetToMeters = 0.3048;
  self.feetToNm = 0.000164579;


  self.englishDistance = ko.observable();
  self.metricDistance = ko.observable();
  self.nmDistance = ko.observable();

  self.measureToolActive = ko.observable(false);

  self.initializeMapControl = function(map)
  {
    var sketchSymbolizers = {
        "Point": {
            pointRadius: 4,
            graphicName: "square",
            fillColor: "white",
            fillOpacity: 1,
            strokeWidth: 1,
            strokeOpacity: 1,
            strokeColor: "#333333"
        },
        "Line": {
            strokeWidth: 2,
            strokeOpacity: 1,
            strokeColor: "#666666"
            //strokeDashstyle: "dash"
        },
        "Polygon": {
            strokeWidth: 2,
            strokeOpacity: 1,
            strokeColor: "#666666",
            fillColor: "white",
            fillOpacity: 0.3
        }
    };
    var measureStyle = new OpenLayers.Style();
    measureStyle.addRules([
        new OpenLayers.Rule({symbolizer: sketchSymbolizers})
    ]);
    var measureStyleMap = new OpenLayers.StyleMap({"default": measureStyle});
    self.measureOLTool = new OpenLayers.Control.Measure(
      OpenLayers.Handler.Path, {
        persist: true,
        displaySystem: 'english',
        handlerOptions:
        {
          layerOptions:
          {
              //renderers: renderer,
              styleMap: measureStyleMap
          }
        }
      }
    );

    map.addControl(self.measureOLTool);
    self.measureOLTool.events.on(
    {
      "measure": self.handleMeasurements
      //"measurepartial" : self.handleMeasurements
    });
    //app.viewModel.measurementTool.setMeasureHandler(app.measureTool);
  };
  self.measureToolClick = function(event)
  {
    //Toggle the state.
    if(self.measureToolActive() === false)
    {
      self.enableControl(true);
    }
    else
    {
      self.enableControl(false);
    }
  };
  self.enableControl = function(enable)
  {
    if(enable)
    {
      self.measureToolActive(true);
      self.measureOLTool.activate();
      self.showMeasurePopup(true);
    }
    else
    {
      self.measureToolActive(false);
      self.showMeasurePopup(false);
      self.measureOLTool.deactivate();
    }
  };
  self.showMeasurePopup = function(show)
  {
    if(show)
    {
      if(!$('#measurement-tool-popover').is(":visible"))
      {
        $('#measurement-tool-popover').show().draggable().position({
              "my": "right middle",
              "at": "left middle",
              "of": $("#btn-measure-tool")
          });
      }
    }
    else
    {
      $('#measurement-tool-popover').hide();
      self.englishDistance("");
      self.metricDistance ("");
      self.nmDistance ("");
    }
  }
  self.handleMeasurements = function(event)
  {
    var geometry = event.geometry;
    var units = event.units;
    var order = event.order;
    var measure = event.measure;

    var metricMeasure = 0;
    var nmMeasure = 0;
    var metricUnits = "";
    if(units === 'mi')
    {
      units = "Miles";
      metricMeasure = (measure * 5280.0 * self.feetToMeters) / 1000.0;
      metricUnits = "Kilometers";
      nmMeasure = (measure * 5280.0) * self.feetToNm;
    }
    else if(units === "ft")
    {
      units = "Feet";
      metricMeasure = measure * self.feetToMeters;
      metricUnits = "Meters";
      nmMeasure = measure * self.feetToNm;
    }
    self.showMeasurePopup(true);

    self.englishDistance(measure.toFixed(3) + " " + units);
    self.metricDistance(metricMeasure.toFixed(3) + " " + metricUnits);
    self.nmDistance(nmMeasure.toFixed(3) + " Nautical Miles");
    /*
    var element = document.getElementById('measurement-output');
    var out = "";
    if(order == 1) {
        out += "measure: " + measure.toFixed(3) + " " + units;
    } else {
        out += "measure: " + measure.toFixed(3) + " " + units + "<sup>2</" + "sup>";
    }
    element.innerHTML = out;
    */
  };
  self.closeWindow = function(event)
  {
    //$('#measurement-tool-popover').hide();
    self.showMeasurePopup(false);
  };

  /*
  self.setMeasureHandler = function(measureToolControl)
  {
    measureToolControl.events.on(
    {
      "measure": self.handleMeasurements
      //"measurepartial" : self.handleMeasurements
    });
  };
  */
};

app.viewModel.measurementTool = new measureToolModel();
})();
