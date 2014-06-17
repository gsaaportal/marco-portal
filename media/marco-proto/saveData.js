(function () {
  var socket,
  socketUrl = app.socketUrl || 'http://localhost:8989';

  function saveDataModel (map, viewModel) {
    var self = this;
    self.$popover = $('#save-data-popover');
    // show print dialog
    self.showSaveDataDialog = function (vm, event) {
      var width = $("#map-panel").width() + $("#legend:visible").width();

      self.$button = $(event.target).closest('.btn');

      // adjust the width depending on legend visibility
      if ($("#legend").is(":visible")) {
          width = width + 60;
      } else {
          width = width + 40;
      }

      self.isGoogle(/Google/.test(app.map.baseLayer.name));

      // set some default options
      self.shotHeight($(document).height());
      self.shotWidth(width);
      self.mapHeight($(document).height());

      self.mapWidth(width);
      self.thumbnail(false);
      self.showLegend(app.viewModel.showLegend() || false);
      self.ratio = self.shotHeight() / self.shotWidth();

      if (self.$popover.is(":visible")) {
          self.$popover.hide();
      }
      else {
        // hide the popover if already visible
        self.jobStatus("Waiting for export to complete");
        self.showSpinner(true);
        self.thumbnail(false);
        self.$popover.show().draggable().position({
            "my": "right middle",
            "at": "left middle",
            "of": self.$button
            /*offset: "0px 100px"*/
        });
      }
    };

    // print server is enabled, don't show button without it
    self.enabled = ko.observable(false);

    self.jobStatus = ko.observable();
    self.showSpinner = ko.observable();

    // job options
    self.format = ko.observable(".pdf");
    self.paperSize = ko.observable("letter");

    // final dimensions of image in pixels
    self.shotHeight = ko.observable();
    self.shotWidth = ko.observable();

    // read or write shot height/width in pixels or inches


    // dpi settings for phantomjs
    self.dpiWidth = 101.981;
    self.dpiHeight = 110.007;

    // working dimensions of map for rendering purposes
    self.mapHeight = ko.observable();
    self.mapWidth = ko.observable();

    // output options
    self.showLegend = ko.observable();
    self.borderLess = ko.observable(false);
    self.title = ko.observable();
    self.jsonData = ko.observable();

    // job results
    self.download = ko.observable();
    self.thumbnail = ko.observable(false);

    // warn if baselayer is google
    self.isGoogle = ko.observable(false);
    self.units = ko.observable("inches");


    self.shotHeightDisplay = ko.computed({
      read: function () {
              var value = self.shotHeight();

              if (self.units() === 'inches') {
                      value = value / self.dpiHeight;
              } else {
                      value = parseInt(value, 10);
              }
              return value;
      },
      write: function (value) {
              if (self.units() === 'inches') {
                      value = value * self.dpiHeight;
              }
              self.shotHeight(value);
      }
    });
    self.shotWidthDisplay = ko.computed({
      read: function () {
              var value = self.shotWidth();

              if (self.units() === 'inches') {
                      value = value / self.dpiWidth;
              } else {
                      value = parseInt(value, 10);
              }
              return value;
      },
      write: function (value) {
              if (self.units() === 'inches') {
                      value = value * self.dpiWidth;
              }
              self.shotWidth(value);
      }
    });

    // legend checkbox shows/hides real legend
    // update positon of popover
    self.showLegend.subscribe(function (newValue) {
            app.viewModel.showLegend(newValue);
    });

    self.units.subscribe(function (units) {
            var steps = units === 'inches' ? 0.1 : 1;
            // save the old value and adjust the steps
            $('.ui-spinner-input').each(function (i, input) {
                    var $input = $(input), val = $input.val();
                    console.log(val);
                    $input.spinner('option', { 'step': steps});
                    $input.val(val);
            });
    });

    // lock aspect ratio with these subscriptions
    self.shotHeight.subscribe(function (newVal) {
            var width = newVal / self.ratio;
            if ($.isNumeric(width) && width !== self.shotWidth()) {
                    self.shotWidth(width);
            }
    });
    self.shotWidth.subscribe(function (newVal) {
            var height = newVal * self.ratio;
            if ($.isNumeric(height) && height !== self.shotHeight()) {
                    self.shotHeight(height);
            }
    });

    // borderless turned on will disable title and legend
    self.borderLess.subscribe(function (newVal) {
      if (newVal === true) {
        self.showLegend(false);
        self.oldTitle = self.title();
        self.title(null);
      } else {
          if (self.oldTitle) {
                  self.title(self.oldTitle);
          }
      }
    });

    // print button in result dialog
    self.print = function () {
      var w = window.open(self.download());
      setTimeout(function () {
              w.print();
              w.close();
      }, 500);

    };

    self.downloadFile = function (self,event) {
      var $modal = $(event.target).closest('.modal');
      $modal.modal('hide');
      window.open(self.download());
    };
    self.savePolygonQueryResults = function()
    {

      var themes = [];
      var themeList = app.viewModel.themes();
      for(var i = 0; i < themeList.length; i++)
      {
        //var theme = self.themes()[i];
        var theme = themeList[i];
        //If the theme has the control, then let's see if the layers have data for the polygon selected.
        if(theme.restIdentifyControls.length)
        {
          var curTheme = null;
          var layersInPoly = null;
          $.each(theme.layers(), function(layerNdx, layer)
          {
            if(layer.layerDataAvailable())
            {
              if(layersInPoly === null)
              {
                layersInPoly = [];
              }
              var layerData = { 'name' : layer.name, 'id': layer.id, 'subLayers' : [] };
              if(layer.subLayers.length)
              {
                $.each(layer.subLayers, function(subLayerNdx, subLayer)
                {
                  if(subLayer.layerDataAvailable())
                  {
                    layerData['subLayers'].push({'name' : subLayer.name, 'id' : subLayer.id});
                  }
                });
              }
              layersInPoly.push(layerData);
            }
          });
          if(layersInPoly)
          {
            curTheme = {'name' : theme.name, 'id' : theme.id, 'layers' : []};
            curTheme['layers'] = layersInPoly;
            themes.push(curTheme);
          }
        }
      }
      // Transform the polygon points into 4326
      var fromProj   = new OpenLayers.Projection("EPSG:102113");
      var toProj = new OpenLayers.Projection("EPSG:4326");
      var convertedPts = [];
      //for(var i = 0; i < app.viewModel.polygonQueryGeom.length; i++)
      for(var i = 0; i < app.viewModel.polygonQueryTool.polygonQueryGeom.length; i++)
      {
        //var curPt = app.viewModel.polygonQueryGeom[i];
        var curPt = app.viewModel.polygonQueryTool.polygonQueryGeom[i];
        var point = new OpenLayers.LonLat(curPt[0],curPt[1]);
        var cnvrtdPt = point.transform( fromProj, toProj );

        convertedPts.push([OpenLayers.Util.toFloat(cnvrtdPt.lon,8),OpenLayers.Util.toFloat(cnvrtdPt.lat,8)]);
      }
      self.jsonData({'themes' : themes, 'polygon' : convertedPts});
      //$.post('/visualize/create_polygon_query_client_file', JSON.stringify({'themes' : themes}));

    };

          // handle export button in print popover
    self.sendSaveDataJob = function (self, event) {
      var mapHeight, mapWidth;
      event.preventDefault();
      self.$popover.hide();

      $("#saving-data-modal").modal('show');

      self.savePolygonQueryResults()

      if (self.borderLess()) {
              mapHeight = $('#map-panel').height() - 2;
              mapWidth = $("#map-panel").width() + 10;
      } else {
              mapHeight = self.mapHeight();
              mapWidth = self.mapWidth();
      }
      var dataStringed = JSON.stringify(self.jsonData());
      //console.log("saveData json payload: " + dataStringed);
      socket.emit('saveData', {
        hash: window.location.hash,

        // size of the screen to start rendering
        screenHeight: $(document).height(),
        screenWidth: $(document).width(),

        // finished image size
        shotHeight: self.shotHeight(),
        shotWidth: self.shotWidth(),

        // actual dimensions of the map at this screenHeight/screenWidth
        mapHeight: mapHeight,
        mapWidth: mapWidth,

        // other options
        title: self.title(),
        format: self.format(),
        borderless: self.borderLess(),
        // pass on the useragent
        userAgent: navigator.userAgent,
        // papersize for pdf
        paperSize: self.paperSize(),
        // extent pixel size in meters for world file
        extent:  app.map.getExtent().toArray(),
        pixelSize: app.map.getGeodesicPixelSize().w * 1000,

        //Data to save
        data: dataStringed

      }, function (data) {
          self.jobStatus("Job is Complete");
          self.showSpinner(false);
          self.thumbnail(data.thumb);
          self.download(data.download);
      });
    };

    // handle cancel is popover
    self.cancel = function () {
            self.$popover.hide();
    };

    // make sure we have a socket
    if (typeof io !== 'undefined') {
            socket = io.connect(socketUrl);
            self.enabled(true);
    } else {
            self.enabled(false);
    }

  }
  var shots = {
          $popover: $("#save-data-popover")
  };
  app.viewModel.saveData = new saveDataModel(app.map, app.viewModel);

  $(document).on('map-ready', function () {
          app.map.events.register('changebaselayer', null, function (event) {
                  console.log('base layer changed');
                  app.viewModel.printing.isGoogle(/Google/.test(event.layer.name));
          });

  });
})();
