function layerModel(options, parent) {
    var self = this,
        $descriptionTemp;

    // properties
    self.id = options.id || null;
    self.name = options.name || null;
    self.url = options.url || null;
    self.arcgislayers = options.arcgis_layers || 0;
    self.type = options.type || null;
    self.utfurl = options.utfurl || false;
    self.legend = options.legend || false;
    self.learn_link = options.learn_link || null;
    self.legendVisibility = ko.observable(false);
    self.legendTitle = options.legend_title || false;
    self.legendType = null;
    self.legendSubTitle = options.legend_subtitle || false;
    self.legendTable = ko.observable(false);
    self.topics = ko.observableArray();
    self.themes = ko.observableArray();
    //self.attributeTitle = options.attributes ? options.attributes.title : self.name;
    self.attributes = options.attributes ? options.attributes.attributes : [];
    self.compress_attributes = options.attributes ? options.attributes.compress_attributes : false;
    self.attributeEvent = options.attributes ? options.attributes.event : [];
    self.lookupField = options.lookups ? options.lookups.field : null;
    self.lookupDetails = options.lookups ? options.lookups.details : [];
    self.color = options.color || "#ee9900";
    self.fillOpacity = options.fill_opacity || 0.0;
    self.defaultOpacity = options.opacity || 0.5;
    self.opacity = ko.observable(self.defaultOpacity);
    self.graphic = options.graphic || null;
    self.restLegend = [];
    
    if(self.type === 'ArcRest')
    {
      self.identifyControl = null;
    }
    
    
    // set target blank for all links
    if (options.description) {
        $descriptionTemp = $("<div/>", {
            html: options.description
        });
        $descriptionTemp.find('a').each(function() {
            $(this).attr('target', '_blank');
        });
        self.description = $descriptionTemp.text();
    } else {
        self.description = null;
    }
    self.getHTMLLegend = function(legendURL)
    {
      self.legendTable('Loading: ' + legendURL);
      $.get(legendURL, function(data)
      {
        self.legendTable(data);
      });
    };
    
    // set overview text for Learn More option
    if (options.overview) {
        self.overview = options.overview;
    } else if (parent && parent.overview) {
        self.overview = parent.overview;
    } else if (self.description) {
        self.overview = self.description;
    } else if (parent && parent.description) {
        self.overview = parent.description;
    } else {
        self.overview = null;
    }
    
    // set data source and data notes text 
    self.data_source = options.data_source || null;
    if (! self.data_source && parent && parent.data_source) {
        self.data_source = parent.data_source;
    } 
    self.data_notes = options.data_notes || null;
    if (! self.data_notes && parent && parent.data_notes) {
        self.data_notes = parent.data_notes;
    } 
    
    // set download links 
    self.kml = options.kml || null;
    self.data_download = options.data_download || null;
    self.metadata = options.metadata || null;
    self.source = options.source || null;
    self.tiles = options.tiles || null;

    // opacity
    if(self.legend.length)
    {
      var parseUrl = document.createElement('a');
      parseUrl.href = self.legend;
      self.legendType = 'json';
      if(parseUrl.search.length)
      {
        self.legendType = 'json';
        //self.getJSONLegend('/proxy/get_legend_json?url=' + self.legend);
      }
      
    }    // opacity
    self.opacity.subscribe(function(newOpacity) {
        if (self.layer.CLASS_NAME === "OpenLayers.Layer.Vector") {
            self.layer.styleMap.styles['default'].defaultStyle.strokeOpacity = newOpacity;
            self.layer.styleMap.styles['default'].defaultStyle.graphicOpacity = newOpacity;
            //fill is currently turned off for many of the vector layers
            //the following should not override the zeroed out fill opacity 
            //however we do still need to account for shipping lanes (in which styling is handled via lookup)
            if (self.fillOpacity > 0) {
                var newFillOpacity = self.fillOpacity - (self.defaultOpacity - newOpacity);
                self.layer.styleMap.styles['default'].defaultStyle.fillOpacity = newFillOpacity;
            }
            self.layer.redraw();
        } else {
            self.layer.setOpacity(newOpacity);
        }
    });

    // is description active
    self.infoActive = ko.observable(false);
    app.viewModel.showOverview.subscribe( function() {
        if ( app.viewModel.showOverview() === false ) {
            self.infoActive(false);
        }
    });
    
    // is the layer a checkbox layer
    self.isCheckBoxLayer = ko.observable(false);
    if (self.type === 'checkbox') {
        self.isCheckBoxLayer(true);
    }
    
    // is the layer in the active panel?
    self.active = ko.observable(false);
    // is the layer visible?
    self.visible = ko.observable(false);       

    self.activeSublayer = ko.observable(false);
    self.visibleSublayer = ko.observable(false);

    self.subLayers = [];

    // save a ref to the parent, if it exists
    if (parent) {
        self.parent = parent;
        self.fullName = self.parent.name + " (" + self.name + ")";
        if ( ! self.legendTitle ) {
            self.legendTitle = self.parent.legendTitle;
        }
        if ( ! self.legendSubTitle ) {
            self.legendSubTitle = self.parent.legendSubTitle;
        }
    } else {
        self.fullName = self.name;
    }


    self.toggleLegendVisibility = function() {
        var layer = this;
        layer.legendVisibility(!layer.legendVisibility());
    };
    
    self.hasVisibleSublayers = function() {
        if ( !self.subLayers ) {
            return false;
        }
        var visibleSubLayers = false;
        $.each(self.subLayers, function(i, sublayer) {
            if (sublayer.visible()) {
                visibleSubLayers = true;
            }
        });
        return visibleSubLayers;
    };

    self.deactivateLayer = function() {
        var layer = this;
        
        //deactivate layer
        self.deactivateBaseLayer();
        
        //remove related utfgrid layer
        if (layer.utfgrid) { 
            self.deactivateUtfGridLayer();
        }
        //remove parent layer
        if (layer.parent) {
            self.deactivateParentLayer();
        }
        //remove sublayer
        if (layer.activeSublayer()) {
            self.deactivateSublayer();
        }
        //DWR
        //Deactivate the identifyControl on the layer if it has one.
        if("identifyControl" in layer)
        {            
          layer.identifyControl.deactivate();
        }
        
        layer.layer = null;

    };
    
    // called from deactivateLayer
    self.deactivateBaseLayer = function() {
        var layer = this;
        // remove from active layers
        app.viewModel.activeLayers.remove(layer);

        //remove the key/value pair from aggregatedAttributes
        app.viewModel.removeFromAggregatedAttributes(layer.name);
        
        layer.active(false);
        layer.visible(false);

        app.setLayerVisibility(layer, false);
        layer.opacity(layer.defaultOpacity);
        
        if ($.inArray(layer.layer, app.map.layers) !== -1) {
            app.map.removeLayer(layer.layer);
        }
    };
    
    // called from deactivateLayer
    self.deactivateUtfGridLayer = function() {
        var layer = this;
        //NEED TO CHECK FOR PARENT LAYER HERE TOO...?
        //the following removes this layers utfgrid from the utfcontrol and prevents continued utf attribution on this layer
        app.map.UTFControl.layers.splice($.inArray(layer.utfgrid, app.map.UTFControl.layers), 1);
        app.map.removeLayer(layer.utfgrid);
    };

    // called from deactivateLayer
    self.deactivateParentLayer = function() {
        var layer = this;
        if (layer.parent && layer.parent.isCheckBoxLayer()) { // if layer has a parent and that layer is a checkbox layer
            // see if there are any remaining active sublayers in this checkbox layer
            var stillActive = false;
            $.each(layer.parent.subLayers, function(i, sublayer) {
                if ( sublayer.active() ) {
                    stillActive = true;
                }
            });
            // if there are no remaining active sublayers, then deactivate parent layer
            if (!stillActive) {
                layer.parent.active(false);
                layer.parent.activeSublayer(false);
                layer.parent.visible(false);
                layer.parent.visibleSublayer(false);
            }
            //check to see if any sublayers are still visible 
            if (!layer.parent.hasVisibleSublayers()) {
                layer.parent.visible(false);
            }
        } else if (layer.parent) { // if layer has a parent
            // turn off the parent shell layer
            layer.parent.active(false);
            layer.parent.activeSublayer(false);
            layer.parent.visible(false);
            layer.parent.visibleSublayer(false);
        } 
    };
    
    // called from deactivateLayer
    self.deactivateSublayer = function() {
        var layer = this;
        if ($.inArray(layer.activeSublayer().layer, app.map.layers) !== -1) {
            app.map.removeLayer(layer.activeSublayer().layer);
        }
        layer.activeSublayer().deactivateLayer();
        layer.activeSublayer(false);
        layer.visibleSublayer(false);
        if("identifyControl" in layer)
        {            
          layer.identifyControl.deactivate();
        }
        
        layer.layer = null;

    };

    self.activateLayer = function(layerVisible) {
        //2013-02-20 DWR
        //Added so we can use the topic button to add the layers into the Active tab, but not make them visible.
        var isVisible = typeof(layerVisible) === "undefined" ? true : layerVisible;
        var layer = this;

        if (!layer.active() && layer.type !== 'placeholder') {
            //app.addLayerToMap(layer, isVisible);
        
            self.activateBaseLayer();

            // save reference in parent layer
            if (layer.parent) {
                self.activateParentLayer();
            }
            if(self.legendTable() === false)
            {
              self.getHTMLLegend(self.legend);
            }
            //add utfgrid if applicable
            if (layer.utfgrid) {
                self.activateUtfGridLayer();
            }

        }
    };
    
    // called from activateLayer
    self.activateBaseLayer = function() {
        var layer = this;
        
        app.addLayerToMap(layer);

        //now that we now longer use the selectfeature control we can simply do the following 
        app.viewModel.activeLayers.unshift(layer);

        // set the active flag
        layer.active(true);
        layer.visible(true);
    };
    
    // called from activateLayer
    self.activateParentLayer = function() {
        var layer = this;
        
        if (layer.parent.type === 'radio' && layer.parent.activeSublayer()) {
            // only allow one sublayer on at a time
            layer.parent.activeSublayer().deactivateLayer();
        }
        layer.parent.active(true);
        layer.parent.activeSublayer(layer);
        layer.parent.visible(true);
        layer.parent.visibleSublayer(layer);
    };
    
    // called from activateLayer
    self.activateUtfGridLayer = function() {
        var layer = this;
        
        app.map.UTFControl.layers.unshift(layer.utfgrid);
    };

    // bound to click handler for layer visibility switching in Active panel
    self.toggleVisible = function() {
        var layer = this;
        
        if (layer.visible()) { //make invisible
            self.setInvisible(layer);
        } else { //make visible
            self.setVisible(layer);
        }
    };
    
    self.setVisible = function() {
        var layer = this;
        
        layer.visible(true);
        if (layer.parent) {
            layer.parent.visible(true);
        }
        app.setLayerVisibility(layer, true);

        //add utfgrid if applicable
        if (layer.utfgrid) {
            app.map.UTFControl.layers.splice($.inArray(this, app.viewModel.activeLayers()), 0, layer.utfgrid);
        }
    }
    
    self.setInvisible = function() {
        var layer = this;
        
        layer.visible(false);
        if (layer.parent) {
            // if layer.parent is not a checkbox, set parent to invisible
            if (layer.parent.type !== 'checkbox') {
                layer.parent.visible(false);
            } else { //otherwise layer.parent is checkbox 
                //check to see if any sublayers are still visible 
                if (!layer.parent.hasVisibleSublayers()) {
                    layer.parent.visible(false);
                }
            }
        }
        app.setLayerVisibility(layer, false);
        
        app.viewModel.removeFromAggregatedAttributes(layer.name);
        
        if ($.isEmptyObject(app.viewModel.visibleLayers())) {
            app.viewModel.closeAttribution();
        }

        //remove related utfgrid layer
        if (layer.utfgrid) {
            //the following removes this layers utfgrid from the utfcontrol and prevents continued utf attribution on this layer
            app.map.UTFControl.layers.splice($.inArray(this.utfgrid, app.map.UTFControl.layers), 1);
        }
    }

    self.showSublayers = ko.observable(false);

    self.showSublayers.subscribe(function () {
        setTimeout(function () {
            $('.layer').find('.open .layer-menu').jScrollPane();
        });
    });

    // bound to click handler for layer switching
    self.toggleActive = function(self, event) {
        var layer = this;

        //handle possible dropdown/sublayer behavior
        if (layer.subLayers.length) {
            if (!layer.activeSublayer()) { //if layer does not have an active sublayer, then show/hide drop down menu
                if (!layer.showSublayers()) {
                    //show drop-down menu
                    layer.showSublayers(true);
                } else {
                    //hide drop-down menu
                    layer.showSublayers(false);
                }
            } else if ( layer.type === 'checkbox' ) { //else if layer does have an active sublayer and it's checkbox (not radio) 
                if (!layer.showSublayers()) {
                    //show drop-down menu
                    layer.showSublayers(true);
                } else {
                    //hide drop-down menu
                    layer.showSublayers(false);
                }
            } else {
                //turn off layer
                layer.deactivateLayer();
                layer.showSublayers(false);
            }
            return;
        }

        // start saving restore state again and remove restore state message from map view
        app.saveStateMode = true;
        app.viewModel.error(null);

        // save a ref to the active layer for editing,etc
        // still using this?
        app.viewModel.activeLayer(layer);

        if (layer.active()) { // if layer is active
            layer.deactivateLayer();
        } else { // otherwise layer is not currently active
            layer.activateLayer();
        }
    };
    

    self.raiseLayer = function(layer, event) {
        var current = app.viewModel.activeLayers.indexOf(layer);
        if (current === 0) {
            // already at top
            return;
        }
        $(event.target).closest('tr').fadeOut('fast', function() {
            app.viewModel.activeLayers.remove(layer);
            app.viewModel.activeLayers.splice(current - 1, 0, layer);
        });
    };

    self.lowerLayer = function(layer, event) {
        var current = app.viewModel.activeLayers.indexOf(layer);
        if (current === app.viewModel.activeLayers().length) {
            // already at top
            return;
        }
        $(event.target).closest('tr').fadeOut('fast', function() {
            app.viewModel.activeLayers.remove(layer);
            app.viewModel.activeLayers.splice(current + 1, 0, layer);
        });
    };

    self.isTopLayer = function(layer) {
        return app.viewModel.activeLayers.indexOf(layer) === 0;
    };

    self.isBottomLayer = function(layer) {
        return app.viewModel.activeLayers.indexOf(layer) === app.viewModel.activeLayers().length - 1;
    };
    
    self.showingLayerAttribution = ko.observable(true);
    self.toggleLayerAttribution = function() {
        var layerID = '#' + app.viewModel.convertToSlug(self.name);
        if ( self.showingLayerAttribution() ) {
            self.showingLayerAttribution(false);
            $(layerID).css('display', 'none');
        } else {
            self.showingLayerAttribution(true);
            $(layerID).css('display', 'block');
        }
        //update scrollbar
        app.viewModel.updateAggregatedAttributesOverlayScrollbar();
    };
    
    self.toggleSublayerDescription = function(layer) {
        if ( ! self.infoActive() ) {
            self.showSublayerDescription(self);
        } else if (layer === app.viewModel.activeInfoSublayer()) {
        } else {
            self.showDescription(self);
        }
    };
    
    self.showSublayerDescription = function(layer) {
        app.viewModel.showOverview(false);
        app.viewModel.activeInfoSublayer(layer);
        layer.infoActive(true);
        layer.parent.infoActive(true);
        app.viewModel.showOverview(true);
        app.viewModel.updateCustomScrollbar('#overview-overlay-text');
        //app.viewModel.updateDropdownScrollbar('#overview-overlay-dropdown');
        app.viewModel.hideMapAttribution();
    };
    
    // display descriptive text below the map
    self.toggleDescription = function(layer) {
		//DWR
        //Turn off the topicInfo.
        app.viewModel.showTopicDescription(false);
        if ( ! layer.infoActive() ) {
            self.showDescription(layer);
        } else {
            self.hideDescription(layer);
        }
    };
    
    self.showDescription = function(layer) {
        app.viewModel.showOverview(false);
        app.viewModel.activeInfoSublayer(false);
        app.viewModel.activeInfoLayer(layer);
        self.infoActive(true);
        if (layer.subLayers.length > 0) {
            $('#overview-overlay').height(195);
        } else {
            $('#overview-overlay').height(186);
        }
        app.viewModel.showOverview(true);
        app.viewModel.updateCustomScrollbar('#overview-overlay-text');
        //app.viewModel.updateDropdownScrollbar('#overview-overlay-dropdown');
        app.viewModel.hideMapAttribution();
    };
    
    self.hideDescription = function(layer) {
        app.viewModel.showOverview(false);
        app.viewModel.activeInfoSublayer(false);
        app.viewModel.showMapAttribution();
    };
    
    self.toggleDescriptionMenu = function(layer) {
        //console.dir(layer);
    };
    
    
    self.showTooltip = function(layer, event) {
        var layerActual;
        $('#layer-popover').hide();
        if (layer.activeSublayer() && layer.activeSublayer().description) {
            layerActual = layer.activeSublayer();
        } else {
            layerActual = layer;
        }
        if (layerActual.description) {
            app.viewModel.layerToolTipText(layerActual.description);
            $('#layer-popover').show().position({
                "my": "right middle",
                "at": "left middle",
                "of": $(event.target).closest(".btn-group")
            });
        }
    };

    // remove the layer dropdrown menu
    self.closeMenu = function(layer, event) {
        $(event.target).closest('.btn-group').removeClass('open');
        layer.showSublayers(false);
    };

    return self;
} // end layerModel


function topicModel(options) {
  var self = this;

  // array of layers associated with the topic.
  //self.layers = ko.observableArray();
  self.themes = [];
  self.layers =[];
  self.display_name = options.display_name;
  self.id = options.id;
  self.description = options.description;
  self.learn_link = options.learn_link;
  
  self.topicActive = ko.observable(false);
  
  self.activateTopic = function()
  {
    self.topicActive(true);
    for(var i = 0; i < self.layers.length; i++)
    {
      var layerObj = self.layers[i];
      //Check to see if the layer has sublayers.
      if(layerObj.subLayers.length)
      {
        $.each(layerObj.subLayers, function(i, sublayer)
        {
          sublayer.activateLayer(false);
        });        
      }
      else
      {
        layerObj.activateLayer(false);
      }
    }      
  };
  self.deactivateTopic = function()
  {
    self.topicActive(false);
    for(var i = 0; i < self.layers.length; i++)
    {
      var layerObj = self.layers[i];
      //Check to see if the layer has sublayers.
      if(layerObj.subLayers.length)
      {
        $.each(layerObj.subLayers, function(i, sublayer)
        {
          sublayer.deactivateLayer();
        });
      }
      else
      {            
        layerObj.deactivateLayer();
      }
    }      
  };
  /*
  //Make the selected topic active/inactive depending on its current state. 
  self.toggleTopicActive = function(topic)
  {
    if(self.topicActive() === false)
    {          
      self.activateTopic()
    }
    //Topic is active, user is attempting to deactivate it.
    else
    {
      self.deactivateTopic()
    }
    app.viewModel.topicChange(topic);
  }*/
  
  //Event handler for the topic info window.
  self.topicDescriptionActive = ko.observable(false);
    
  app.viewModel.showTopicDescription.subscribe( function()
  {
    if( app.viewModel.showTopicDescription() === false )
    {
      self.topicDescriptionActive(false);
    }
  });
  
  self.toggleTopicDescription = function(topic)
  {
    app.viewModel.showDescription(false);
    
    //If the topic description window is already open, close it.
    if ( topic.topicDescriptionActive() )
    {
      app.viewModel.showTopicDescription(false);
    }
    else
    {
      app.viewModel.showTopicDescription(false);
      app.viewModel.activeTopicInfo(topic);
      self.topicDescriptionActive(true);
      app.viewModel.showTopicDescription(true);
    }
  };


  return(self);
}

function themeModel(options) {
    var self = this;
    self.name = options.display_name;
    self.id = options.id;
    self.description = options.description;
    self.learn_link = options.learn_link;

    // array of layers
    self.layers = ko.observableArray();

    //add to open themes
    self.setOpenTheme = function() {
        var theme = this;
        
        // ensure data tab is activated
        $('#dataTab').tab('show');

        if (self.isOpenTheme(theme)) {
            //app.viewModel.activeTheme(null);
            app.viewModel.openThemes.remove(theme);
            app.viewModel.updateScrollBars();
        } else {
            app.viewModel.openThemes.push(theme);
            //setTimeout( app.viewModel.updateScrollBar(), 1000);
            app.viewModel.updateScrollBars();
        }
    };
    
    //is in openThemes
    self.isOpenTheme = function() {
        var theme = this;
        if (app.viewModel.openThemes.indexOf(theme) !== -1) {
            return true;
        }
        return false;
    };

    //display theme text below the map
    self.setActiveTheme = function() {
        var theme = this;
        app.viewModel.activeTheme(theme);
        app.viewModel.activeThemeName(self.name);
        app.viewModel.themeText(theme.description);
    };

    // is active theme
    self.isActiveTheme = function() {
        var theme = this;
        if (app.viewModel.activeTheme() == theme) {
            return true;
        }
        return false;
    };

    self.hideTooltip = function(theme, event) {
        $('.layer-popover').hide();
    };

    return self;
} // end of themeModel

function mapLinksModel() {
    var self = this;
    
    self.cancel = function() {
        $('#map-links-popover').hide();
    };
    
    self.getURL = function() {
        //return window.location.href;
        return 'http://portal.midatlanticocean.org' + app.viewModel.currentURL();
    };
    
    self.shrinkURL = ko.observable();
    self.shrinkURL.subscribe( function() {
        if (self.shrinkURL()) {
            self.useShortURL();
        } else {
            self.useLongURL();
        }
    });
    
    self.useLongURL = function() {
        $('#short-url')[0].value = self.getURL();
    };
        
    self.useShortURL = function() {
        var bitly_login = "ecofletch",
            bitly_api_key = 'R_d02e03290041107b75e3720d7e3c4b95',
            long_url = self.getURL();
            
        $.getJSON( 
            "http://api.bitly.com/v3/shorten?callback=?", 
            { 
                "format": "json",
                "apiKey": bitly_api_key,
                "login": bitly_login,
                "longUrl": long_url
            },
            function(response)
            {
                $('#short-url')[0].value = response.data.url;
            }
        );
    };
    
    self.getPortalURL = function() {
        var urlOrigin = window.location.origin,
            urlHash = window.location.hash;
        return urlOrigin + '/visualize/' + urlHash;
    };
    
    self.setIFrameHTML = function() {
        $('#iframe-html')[0].value = self.getIFrameHTML();
    };
    
    self.getIFrameHTML = function(bookmarkState) {
        var urlOrigin = window.location.origin,
            urlHash = window.location.hash;
        //console.log(urlOrigin);
        //console.log(urlHash);
        //console.log(app.viewModel.currentURL());
        //app.updateURL();
        //urlHash = app.viewModel.currentURL().replace('visualize/', '')
        if ( bookmarkState ) {
            urlHash = '#'+$.param(bookmarkState);
        }
        if ( !urlOrigin ) {
            urlOrigin = 'http://' + window.location.host;
        }
        var embedURL = urlOrigin + '/embed/map/' + urlHash;
        //console.log(embedURL);
        return '<iframe width="600" height="450" frameborder="0" scrolling="no" marginheight="0" marginwidth="0"' +
                                     'src="' + embedURL + '">' + '</iframe>' + '<br />';
        //$('#iframe-html')[0].value = '<iframe width="600" height="450" frameborder="0" scrolling="no" marginheight="0" marginwidth="0"' +
        //                             'src="' + embedURL + '">' + '</iframe>' + '<br />';
    };
    
    self.openIFrameExample = function(info) {
        var windowName = "newMapWindow",
            windowSize = "width=650, height=550";
            mapWindow = window.open('', windowName, windowSize);
        var urlOrigin = window.location.origin;
        if ( !urlOrigin ) {
            urlOrigin = 'http://' + window.location.host;
        }
        var header = '<a href="/visualize"><img src="'+urlOrigin+'/media/marco/img/marco-logo_planner.jpg" style="border: 0px;"/></a>';
        if (info === 'bookmark') {
            var iframeID = '#bookmark-iframe-html';
        } else {
            var iframeID = '#iframe-html';
        }
        mapWindow.document.write('<html><body>' + header + '<div class="pull-left">' + $(iframeID)[0].value + '</div>' + '</body></html>');
        mapWindow.document.close();
        
    };

    return self;
} // end of mapLinks Model


function viewModel() {
    var self = this;

    self.modernBrowser = ko.observable( !($.browser.msie && $.browser.version < 9.0) );
    
    // list of active layermodels
    self.activeLayers = ko.observableArray();

    // list of visible layermodels in same order as activeLayers
    self.visibleLayers = ko.computed(function() {
        return $.map(self.activeLayers(), function(layer) {
            if (layer.visible()) {
                return layer;
            }
        });
    });
    
    self.visibleLayers.subscribe( function() {
        self.updateAttributeLayers();
        //DWR
        //Disable the identifyControl on layers that have it when they are no longer visible.
        var firstVisLayer = self.visibleLayers()[0];
        //Disable the identify controls
        $.each(self.activeLayers(), function(i, layer) {
          if("identifyControl" in layer)               //User has clicked the Identify button
            
          {
            //If the layer is the first visible layer, enable the identify control.
            if((app.viewModel.identifyFeatureActive()) &&
               (layer === firstVisLayer))
            {
              layer.identifyControl.activate();
            }
            else
            {
              layer.identifyControl.deactivate();
            }
          }          
        });
        
    });
    
    self.attributeLayers = ko.observable();
    
    self.featureAttribution = ko.observable(true);
    self.enableFeatureAttribution = function() {
        self.aggregatedAttributes(false);
        self.featureAttribution(true);
    };
    self.disableFeatureAttribution = function() {
        self.featureAttribution(false); 
        app.markers.clearMarkers();
    };
    
    self.updateAttributeLayers = function() {
        var attributeLayersList = [];
        if (self.scenarios && self.scenarios.scenarioFormModel && self.scenarios.scenarioFormModel.isLeaseblockLayerVisible()) {
            attributeLayersList.push(self.scenarios.leaseblockLayer().layerModel);
        }
        
        $.each(self.visibleLayers(), function(index, layer) {
            attributeLayersList.push(layer);
        });
        self.attributeLayers(attributeLayersList);
    };
    
    // boolean flag determining whether or not to show layer panel
    self.showLayers = ko.observable(true);
    
    self.showLayersText = ko.computed(function() {
        if (self.showLayers()) return "Hide Layers";
        else return "Show Layers";
    });
    
    // toggle layer panel visibility
    self.toggleLayers = function() {
        self.showLayers(!self.showLayers());
        app.map.render('map');
        if (self.showLayers()) app.map.render('map'); //doing this again seems to prevent the vector wandering effect
        app.updateUrl();
        //if toggling layers during default pageguide, then correct step 4 position
        //self.correctTourPosition();
        //throws client-side error in pageguide.js for some reason...
    };

    // reference to open themes in accordion
    self.openThemes = ko.observableArray();
    
    self.openThemes.subscribe( function() {
        app.updateUrl();
    });

    self.getOpenThemeIDs = function() {
        return $.map(self.openThemes(), function(theme) {
            return theme.id;
        });
    };
    
    // reference to active theme model/name for display text
    self.activeTheme = ko.observable();
    self.activeThemeName = ko.observable();

    // list of theme models
    self.themes = ko.observableArray();

    // last clicked layer for editing, etc
    self.activeLayer = ko.observable();
  
    //2013-03-01  DWR
    // determines visibility of topic description overlay
    self.showTopicDescription = ko.observable();
    self.activeTopicInfo = ko.observable(false);
    self.activeTopic = ko.observable(false);
    self.topics = ko.observableArray();
    self.topicIndex = {};
    //Topic change handler.
    self.topicChange = function(currentTopic)
    {
      if(self.activeTopic())
      {
        self.activeTopic().deactivateTopic();
        //Are we changing topics?
        if(currentTopic.display_name != self.activeTopic().display_name)
        {
          self.activeTopic().deactivateTopic();
          self.activeTopic(currentTopic);
          self.activeTopic().activateTopic();
        }
        //Topic just clicked is the one we had, this means it is getting deactivated, so let's reset our active topic to be nothing.
        else
        {
          self.activeTopic().deactivateTopic();
          self.activeTopic(false);  
        }
      }
      else
      {
        self.activeTopic(currentTopic);        
        self.activeTopic().activateTopic();
      }
    };
    self.featureRequested = ko.observable(false);
    //Layer Feature Identify
    self.identifyFeatureActive = ko.observable(false);
    //Button handler for the identify feature function.
    self.identifyFeature = function(self, event)
    {
      //Toggle the state.
      if(self.identifyFeatureActive() === false)
      {
        self.identifyFeatureActive(true);
        //Activate the Identify tab.
        $('#identifyTab').tab('show');
      }
      else
      {
        self.identifyFeatureActive(false);
      }

      var layers = self.visibleLayers();
      $.each(layers, function(index, layer) {
        if("identifyControl" in layer)
        {
          //var layerNdx = app.viewModel.activeLayers.indexOf(layer);                    
          if(self.identifyFeatureActive() &&
             (index === 0))
          {
            layer.identifyControl.activate();
          }
          else
          {
            layer.identifyControl.deactivate();            
          }
        }
      });
      
    };
    // determines visibility of description overlay
    self.showDescription = ko.observable();
    // determines visibility of expanded description overlay
    self.showOverview = ko.observable();
    
    // theme text currently on display
    self.themeText = ko.observable();

    // index for filter autocomplete and lookups
    self.layerIndex = {};
    self.layerSearchIndex = {};

    self.bookmarkEmail = ko.observable();
        
    self.mapLinks = new mapLinksModel();

    // text for tooltip popup
    self.layerToolTipText = ko.observable();

    // descriptive text below the map 
    self.activeInfoLayer = ko.observable(false);
    self.activeInfoSublayer = ko.observable(false);

    // attribute data
    self.attributeTitle = ko.observable(false);
    self.attributeData = ko.observable(false);
    
    self.aggregatedAttributes = ko.observable(false);
    self.aggregatedAttributesWidth = ko.observable('280px');
    self.aggregatedAttributes.subscribe( function() {
        self.updateAggregatedAttributesOverlayWidthAndScrollbar();
    });
    self.removeFromAggregatedAttributes = function(layerName) {
        delete app.viewModel.aggregatedAttributes()[layerName];
        //if there are no more attributes left to display, then remove the overlay altogether
        if ($.isEmptyObject(self.aggregatedAttributes())) {
            self.closeAttribution();
        } else {
            //because the subscription on aggregatedAttributes is not triggered by this delete process
            self.updateAggregatedAttributesOverlayWidthAndScrollbar();
            //self.updateCustomScrollbar('#aggregated-attribute-content');
        }
    };
    self.updateAggregatedAttributesOverlayWidthAndScrollbar = function() {
        setTimeout( function() {
            var overlayWidth = (document.getElementById('aggregated-attribute-overlay-test').clientWidth+50),
                width = overlayWidth < 380 ? overlayWidth : 380;
            //console.log('setting overlay width to ' + width);
            self.aggregatedAttributesWidth(width + 'px');
            self.updateCustomScrollbar('#aggregated-attribute-content');
        }, 500);
    };
    self.updateAggregatedAttributesOverlayScrollbar = function() {
        self.updateCustomScrollbar('#aggregated-attribute-content');
    };

    // title for print view
    self.mapTitle = ko.observable();

    self.closeAttribution = function() {
        self.aggregatedAttributes(false);
        app.markers.clearMarkers();
    };
    
    self.updateMarker = function() {
        app.markers.clearMarkers();
        if (app.marker && self.aggregatedAttributes() && self.featureAttribution()) {
            //console.log('updating marker');
            app.markers.addMarker(app.marker);
            app.map.setLayerIndex(app.markers, 99);
        }
    };
    
    /*
    self.getAttributeHTML = function() {
        var html = "";
        $.each(self.activeLayers(), function(i, layer) {
            if (self.aggregatedAttributes()[layer.name]) {
                html += "<h4>"+layer.name+".<h4>";
                html += "<dl>";
                $.each(self.aggregatedAttributes()[layer.name], function(j, attrs) {
                    html += "<dt><span>"+attrs.display+"</span>:";
                    html += "<span>"+attrs.data+"</span></dt>";
                });
                html += "</dl>";
            }
        });
        return html;
    };
    */
    // hide tours for smaller screens
    self.hideTours = ko.observable(false);

    // set the error type
    // can be one of:
    //  restoreState
    self.error = ko.observable();
    self.clearError = function() {
        self.error(null);
    };
    
    self.isFullScreen = ko.observable(false);
    
    self.fullScreenWithLayers = function() {
        return self.isFullScreen() && self.showLayers();
    };

    // show the map?
    self.showMapPanel = ko.observable(true);

    //show/hide the list of basemaps
    self.showBasemaps = function(self, event) {
        var $layerSwitcher = $('#SimpleLayerSwitcher_30'),
            $button = $('#basemaps'); //$(event.target).closest('.btn');
        if ($layerSwitcher.is(":visible")) {
            $layerSwitcher.hide();
        } else {
            $layerSwitcher.show();
        }
    };

    // zoom with box
    self.zoomBoxIn = function (self, event) {
        var $button = $(event.target).closest('.btn');
        self.zoomBox($button)
    };
    self.zoomBoxOut = function (self, event) {
        var $button = $(event.target).closest('.btn');
        self.zoomBox($button, true)
    };
    self.zoomBox = function  ($button, out) {
        // out is a boolean to specify whether we are zooming in or out
        // true: zoom out
        // not present/false zoom in
        if ($button.hasClass('active')) {
            self.deactivateZoomBox();
        } else {
            $button.addClass('active');
            $button.siblings('.btn-zoom').removeClass('active');
            if (out) {
                app.map.zoomBox.out = true;
            } else {
                app.map.zoomBox.out = false;
            }
            app.map.zoomBox.activate();            
            $('#map').addClass('zoomBox');

        }
    };
    self.deactivateZoomBox = function ($button) {
        var $button = $button || $('.btn-zoom');
        app.map.zoomBox.deactivate();
        $button.removeClass('active');
        $('#map').removeClass('zoomBox');
    };

    // is the legend panel visible?
    self.showLegend = ko.observable(false);
    self.showLegend.subscribe(function (newVal) {
        self.updateScrollBars();
        if (self.printing.enabled()) {
            self.printing.showLegend(newVal);
        }

        //app.reCenterMap();

    });

    self.activeLegendLayers = ko.computed(function() {
        var layers = $.map(self.visibleLayers(), function(layer) {
            if (layer.legend || layer.legendTitle) {
                return layer;
            }
        });

        // remove any layers with duplicate legend titles
        var seen = {};
        for (i = 0; i < layers.length; i++) {
            var title = layers[i].legendTitle ? layers[i].legendTitle : layers[i].name;
            if (seen[title]) {
                layers.splice(i, 1);
                i--;
            } else {
                seen[title] = true;
            }
        }
        return layers;
    });

    self.legendButtonText = ko.computed(function() {
        if (self.showLegend()) return "Hide Legend";
        else return "Show Legend";
    });

    // toggle legend panel visibility
    self.toggleLegend = function() {
        self.showLegend(!self.showLegend());
        if (!self.showLegend()) {
            app.map.render('map');
        } else {
            //update the legend scrollbar
            //$('#legend-content').data('jsp').reinitialise();
            self.updateScrollBars();
        }
        
        //app.map.render('map');
        //if toggling legend during default pageguide, then correct step 4 position
        self.correctTourPosition();
    };

    // determine whether app is offering legends 
    self.hasActiveLegends = ko.computed(function() {
        var hasLegends = false;
        $.each(self.visibleLayers(), function(index, layer) {
            if (layer.legend || layer.legendTitle) {
                hasLegends = true;
            }
        });
        return hasLegends;
    });

    // close error-overlay
    self.closeAlert = function(self, event) {
        app.viewModel.error(null);
        $('#fullscreen-error-overlay').hide();
    };
    
    self.updateAllScrollBars = function() {
        self.updateScrollBars();
        if (self.scenarios) {
            self.scenarios.updateDesignsScrollBar();
        }
    };
    
    //update jScrollPane scrollbar
    self.updateScrollBars = function() {
    
        var dataScrollpane = $('#data-accordion').data('jsp');
        if (dataScrollpane === undefined) {
            $('#data-accordion').jScrollPane();
        } else {
            dataScrollpane.reinitialise();
        }
        
        var activeScrollpane = $('#active').data('jsp');
        if (activeScrollpane === undefined) {
            $('#active').jScrollPane();
        } else {
            activeScrollpane.reinitialise();
        }
        
        var legendScrollpane = $('#legend-content').data('jsp');
        if (legendScrollpane === undefined) {
            $('#legend-content').jScrollPane();
        } else {
            setTimeout(function() {legendScrollpane.reinitialise();},100);
        }
        
    };

    // expand data description overlay
    self.expandDescription = function(self, event) {
        if ( ! self.showOverview() ) {
            self.showOverview(true);
            self.updateCustomScrollbar('#overview-overlay-text');
        } else {
            self.showOverview(false);
        }
    };
    
    self.scrollBarElements = [];
    
    self.updateCustomScrollbar = function(elem) {
        if (app.viewModel.scrollBarElements.indexOf(elem) == -1) {
            app.viewModel.scrollBarElements.push(elem);
            $(elem).mCustomScrollbar({
                scrollInertia:250,
                mouseWheel: 6
            });
        }
        //$(elem).mCustomScrollbar("update");
        setTimeout( function() { $(elem).mCustomScrollbar("update"); }, 500);
    };
    
    // close layer description
    self.closeDescription = function() {
        //self.showDescription(false);
        app.viewModel.showOverview(false);
        if ( ! app.pageguide.tourIsActive ) {
            app.viewModel.showMapAttribution();
        }
    };
    // close topic description
    self.closeTopicDescription = function(self, event) {
        self.showTopicDescription(false);
    };
    
    self.activateOverviewDropdown = function(model, event) {
        var $btnGroup = $(event.target).closest('.btn-group');
        if ( $btnGroup.hasClass('open') ) {
            $btnGroup.removeClass('open');
        } else {
            //$('#overview-dropdown-button').dropdown('toggle');  
            $btnGroup.addClass('open');
            if (app.viewModel.scrollBarElements.indexOf('#overview-overlay-dropdown') == -1) {
                app.viewModel.scrollBarElements.push('#overview-overlay-dropdown');
                $('#overview-overlay-dropdown').mCustomScrollbar({
                    scrollInertia:250,
                    mouseWheel: 6
                });
            }
            //debugger;
            //setTimeout( $('#overview-overlay-dropdown').mCustomScrollbar("update"), 1000);
            $('#overview-overlay-dropdown').mCustomScrollbar("update");
        }
    }; 
    
    self.getOverviewText = function() {
        //activeInfoSublayer() ? activeInfoSublayer().overview : activeInfoLayer().overview
        if ( self.activeInfoSublayer() ) {
            if ( self.activeInfoSublayer().overview === null ) {
                return '';
            } else {
                return self.activeInfoSublayer().overview;
            }   
        } else if (self.activeInfoLayer() ) {
            if ( self.activeInfoLayer().overview === null ) {
                return '';
            } else {
                return self.activeInfoLayer().overview;
            }  
        } else {
            return '';
        }
    };
    
    self.activeKmlLink = function() {
        if ( self.activeInfoSublayer() ) {
            return self.activeInfoSublayer().kml;
        } else if (self.activeInfoLayer() ) {
            return self.activeInfoLayer().kml;
        } else {
            return false;
        }
    };

    self.activeDataLink = function() {
        //activeInfoLayer().data_download
        if ( self.activeInfoSublayer() ) {
            return self.activeInfoSublayer().data_download;
        } else if (self.activeInfoLayer() ) {
            return self.activeInfoLayer().data_download;
        } else {
            return false;
        }
    };
    
    self.activeMetadataLink = function() {
        //activeInfoLayer().metadata
        if ( self.activeInfoSublayer() ) {
            return self.activeInfoSublayer().metadata;
        } else if (self.activeInfoLayer() ) {
            return self.activeInfoLayer().metadata;
        } else {
            return false;
        }
    };
    
    self.activeSourceLink = function() {
        //activeInfoLayer().source
        if ( self.activeInfoSublayer() ) {
            return self.activeInfoSublayer().source;
        } else if (self.activeInfoLayer() ) {
            return self.activeInfoLayer().source;
        } else {
            return false;
        }
    };
        
    self.activeTilesLink = function() {
        //activeInfoLayer().source
        if ( self.activeInfoSublayer() ) {
            return self.activeInfoSublayer().tiles;
        } else if (self.activeInfoLayer() ) {
            return self.activeInfoLayer().tiles;
        } else {
            return false;
        }
    };
        
    //assigned in app.updateUrl (in state.js)
    self.currentURL = ko.observable();


    // show bookmark stuff
    self.showBookmarks = function(self, event) {
        var $button = $(event.target).closest('.btn'),
            $popover = $('#bookmark-popover');

        if ($popover.is(":visible")) {
            $popover.hide();
        } else {
            self.bookmarks.newBookmarkName(null);
            //TODO: move all this into bookmarks model
            // hide the popover if already visible
            $popover.show().position({
                "my": "right middle",
                "at": "left middle",
                "of": $button,
                offset: "-10px 0px"
            });
            self.bookmarks.updateBookmarkScrollBar();
        }
    };
    
    //show Map Links
    /*
    self.showMapLinks = function(self, event) {
        var $button = $(event.target).closest('.btn'),
            $popover = $('#map-links-popover');

        if ($popover.is(":visible")) {
            $popover.hide();
        } else {
            self.resetMapLinks();
            $popover.show().position({
                "my": "top",
                "at": "top",
                "of": $('#map'),
                offset: "0px 10px"
            });
        }
    };
    */
    
    self.resetMapLinks = function() {
        self.mapLinks.shrinkURL(false);
        $('#short-url').text = self.mapLinks.getURL();
        self.mapLinks.setIFrameHTML();
    };
    
    self.selectedLayer = ko.observable();

    self.showOpacity = function(layer, event) {
        var $button = $(event.target).closest('a'),
            $popover = $('#opacity-popover');

        self.selectedLayer(layer);

        if ($button.hasClass('active')) {
            self.hideOpacity();
        } else {
            $popover.show().position({
                "my": "center top",
                "at": "center bottom",
                "of": $button,
                "offset": "0px 10px"
            });
            $button.addClass('active');
        }
    };

    self.hideOpacity = function(self, event) {
        $('#opacity-popover').hide();
        $('.opacity-button.active').removeClass('active');
        app.updateUrl();
    };
    self.hideTooltip = function() {
        $('#layer-popover').hide();
    };


    // show coords info in pointer
    self.showPointerInfo = ko.observable(false);
    self.togglePointerInfo = function() {
        self.showPointerInfo(!self.showPointerInfo());
    };

    // get layer by id
    self.getLayerById = function(id) {
        for (var x=0; x<self.themes().length; x++) {
            var layer_list = $.grep(self.themes()[x].layers(), function(layer) { return layer.id === id });
            if (layer_list.length > 0) {
                return layer_list[0];
            }
        }
        return false;
    };

    // handle the search form
    self.searchTerm = ko.observable();
    self.layerSearch = function() {
        var found = self.layerSearchIndex[self.searchTerm()];
        //self.activeTheme(theme);
        self.openThemes.push(found.theme);
        found.layer.activateLayer();
    };
    self.keySearch = function(_, event) {

        if (event.which === 13) {
            self.searchTerm($('.typeahead .active').text());
            self.layerSearch();
        }
        $('ul.typeahead').on('click', 'li', function () {
            self.searchTerm($('.typeahead .active').text());
            self.layerSearch();
            //search($(this).text());
        });
    };

    // do this stuff when the active layers change
    self.activeLayers.subscribe(function() {
        // initial index
        var index = 300;
        app.state.activeLayers = [];

        //self.showLegend(false);
        $.each(self.activeLayers(), function(i, layer) {
            // set the zindex on the openlayers layer
            // layers at the beginning of activeLayers
            // are above those that are at the end
            // also save the layer state
            app.setLayerZIndex(layer, index);
            //2013-03-01
            //If the layer has an identify control object and the user has enabled the identify tool, lets make sure the layer at the
            //top of the active list is the one we query.
            
            if(("identifyControl" in layer) &&                        //Layer has identifyControl
               (app.viewModel.identifyFeatureActive()))               //User has clicked the Identify button
              
            {
              //If the layer is at the top of the Z order, activate it for feature identify.
              index === 300 ? layer.identifyControl.activate() : layer.identifyControl.deactivate();
            }
            
            index--;
        });

        // re-ordering map layers by z value
        app.map.layers.sort(function(a, b) {
            return a.getZIndex() - b.getZIndex();
        });

        //update the legend scrollbar
        //setTimeout(function() {$('#legend-content').data('jsp').reinitialise();}, 200);
        setTimeout(function() { app.viewModel.updateScrollBars(); }, 200);
        
        // update the url hash
        app.updateUrl();

    });
    
    self.deactivateAllLayers = function() {
        //$.each(self.activeLayers(), function (index, layer) {
        var numActiveLayers = self.activeLayers().length;
        for (var i=0; i < numActiveLayers; i++) {
            self.activeLayers()[0].deactivateLayer();
        }
    };
    
    self.closeAllThemes = function() {
        var numOpenThemes = self.openThemes().length;
        for (var i=0; i< numOpenThemes; i++) {
            self.openThemes.remove(self.openThemes()[0]);
        }
        self.updateScrollBars();
    };

    // do this stuff when the visible layers change
    /*self.visibleLayers.subscribe(function() {
        if (!self.hasActiveLegends()) {
            self.showLegend(false);
        }
    });*/
    
    /* DESIGNS */
    
    self.showCreateButton = ko.observable(true);
    
    /* Wind Design */
    self.showWindDesignWizard = ko.observable(false);
    self.windDesignStep1 = ko.observable(false);
    self.windDesignStep2 = ko.observable(false);
    self.windDesignStep3 = ko.observable(false);
    
    self.startWindDesignWizard = function() {
        self.showCreateButton(false);
        self.showWindDesignWizard(true);
        self.showWindDesignStep1();
    };
    
    self.showWindDesignStep1 = function() {
        self.windDesignStep1(true);
        $('#wind-design-breadcrumb-step-1').addClass('active');
        self.windDesignStep2(false);
        $('#wind-design-breadcrumb-step-2').removeClass('active');
        self.windDesignStep3(false);
        $('#wind-design-breadcrumb-step-3').removeClass('active');
    };
    
    self.showWindDesignStep2 = function() {
        self.windDesignStep1(false);
        $('#wind-design-breadcrumb-step-1').removeClass('active');
        self.windDesignStep2(true);
        $('#wind-design-breadcrumb-step-2').addClass('active');
        self.windDesignStep3(false);
        $('#wind-design-breadcrumb-step-3').removeClass('active');
    };
    
    self.showWindDesignStep3 = function() {
        self.windDesignStep1(false);
        $('#wind-design-breadcrumb-step-1').removeClass('active');
        self.windDesignStep2(false);
        $('#wind-design-breadcrumb-step-2').removeClass('active');
        self.windDesignStep3(true);
        $('#wind-design-breadcrumb-step-3').addClass('active');
    };
    /* END Wind Design */
    
    self.startDefaultTour = function() {
        if ( $.pageguide('isOpen') ) { // activated when 'tour' is clicked
            // close the pageguide
            app.pageguide.togglingTours = true;
            $.pageguide('close');
        } else {
            //save state
            app.pageguide.state = app.getState();
            app.saveStateMode = false;   
        }
        
        //show the data layers panel
        app.viewModel.showLayers(true);
        
        //ensure pageguide is managing the default guide
        $.pageguide(defaultGuide, defaultGuideOverrides);
        
        //adding delay to ensure the message will load 
        setTimeout( function() { $.pageguide('open'); }, 700 );
        //$('#help-tab').click();
        
        app.pageguide.togglingTours = false;
    };
    
    self.stepTwoOfBasicTour = function() {
        $('.pageguide-fwd')[0].click();
    }
    
    self.startDataTour = function() {
        //ensure the pageguide is closed 
        if ( $.pageguide('isOpen') ) { // activated when 'tour' is clicked
            // close the pageguide
            app.pageguide.togglingTours = true;
            $.pageguide('close');
        } else {
            //save state
            app.pageguide.state = app.getState();
            app.saveStateMode = false;   
        }
        
        //show the data layers panel
        app.viewModel.showLayers(true);
        
        //switch pageguide from default guide to data guide
        $.pageguide(dataGuide, dataGuideOverrides);
        
        //show the data tab, close all themes and deactivate all layers, and open the Admin theme
        app.viewModel.closeAllThemes();
        app.viewModel.deactivateAllLayers();
        app.viewModel.themes()[0].setOpenTheme();
        app.setMapPosition(-73, 38.5, 7);
        $('#dataTab').tab('show');
         
        //start the tour
        setTimeout( function() { $.pageguide('open'); }, 700 );
        
        app.pageguide.togglingTours = false;
    };
    
    self.startActiveTour = function() {
        //ensure the pageguide is closed 
        if ( $.pageguide('isOpen') ) { // activated when 'tour' is clicked
            // close the pageguide
            app.pageguide.togglingTours = true;
            $.pageguide('close');
        } else {
            //save state
            app.pageguide.state = app.getState();
            app.saveStateMode = false;   
        }
        
        //show the data layers panel
        app.viewModel.showLayers(true);
        
        //switch pageguide from default guide to active guide
        $.pageguide(activeGuide, activeGuideOverrides);
        
        //show the active tab, close all themes and deactivate all layers, activate a couple layers
        //app.viewModel.closeAllThemes();
        app.viewModel.deactivateAllLayers();
        //activate desired layers
        for (var i=0; i < app.viewModel.themes()[0].layers().length; i++) {
            if ( app.viewModel.themes()[0].layers()[i].name === 'OCS Lease Blocks' ) { //might be more robust if indexOf were used
                app.viewModel.themes()[0].layers()[i].activateLayer();
            }
        }
        for (var i=0; i < app.viewModel.themes()[2].layers().length; i++) {
            if ( app.viewModel.themes()[2].layers()[i].name === 'Benthic Habitats (South)' ) {
                app.viewModel.themes()[2].layers()[i].activateLayer();
            }
        }
        app.setMapPosition(-75, 37.6, 8);
        $('#activeTab').tab('show');
        
        //start the tour
        setTimeout( function() { $.pageguide('open'); }, 700 );
        
        app.pageguide.togglingTours = false;
    };
    
    //if toggling legend or layers panel during default pageguide, then correct step 4 position
    self.correctTourPosition = function() {
        if ( $.pageguide('isOpen') ) {
            if ($.pageguide().guide().id === 'default-guide') {
                $.pageguide('showStep', $.pageguide().guide().steps.length-1);
            }
        }
    };
    
    self.showMapAttribution = function() {
        $('.olControlScaleBar').show();
        $('.olControlAttribution').show();
    };
    self.hideMapAttribution = function() {
        $('.olControlScaleBar').hide();
        $('.olControlAttribution').hide();
    };
    
    self.convertToSlug = function(orig) {
        return orig
            .toLowerCase()
            .replace(/[^\w ]+/g,'')
            .replace(/ +/g,'-');
    };
    
    /* REGISTRATION */
    self.username = ko.observable();
    self.usernameError = ko.observable(false);
    self.password1 = ko.observable("");
    self.password2 = ko.observable("");
    self.passwordWarning = ko.observable(false);
    self.passwordError = ko.observable(false);
    self.passwordSuccess = ko.observable(false);
    self.inactiveError = ko.observable(false);
    
    self.verifyLogin = function(form) {
        var username = $(form.username).val(),
            password = $(form.password).val();
        if (username && password) {
            $.ajax({ 
                async: false,
                url: '/marco_profile/verify_password', 
                data: { username: username, password: password }, 
                type: 'POST',
                dataType: 'json',
                success: function(result) { 
                    if (result.verified === 'inactive') {
                        self.inactiveError(true);
                    } else if (result.verified === true) {
                        self.passwordError(false);
                    } else {
                        self.passwordError(true);
                    }
                },
                error: function(result) { } 
            });
            if (self.passwordError() || self.inactiveError()) {
                return false;
            } else {
                self.bookmarks.getBookmarks();
                return true;
            }
        }
        return false;
    };
    self.turnOffInactiveError = function() {
        self.inactiveError(false);
    };
    
    self.verifyPassword = function(form) {
        var username = $(form.username).val(),
            old_password = $(form.old_password).val();
        self.password1($(form.new_password1).val());
        self.password2($(form.new_password2).val());
        self.checkPassword();
        if ( ! self.passwordWarning() ) {
            if (username && old_password) {
                $.ajax({ 
                    async: false,
                    url: '/marco_profile/verify_password', 
                    data: { username: username, password: old_password }, 
                    type: 'POST',
                    dataType: 'json',
                    success: function(result) { 
                        if (result.verified === true) {
                            self.passwordError(false);
                        } else {
                            self.passwordError(true);
                        }
                    },
                    error: function(result) { } 
                });
                if (self.passwordError()) {
                    return false;
                } else {
                    return true;
                }
            }
        }
        return false;
    };
    self.turnOffPasswordError = function() {
        self.passwordError(false);
    };
    
    
    self.checkPassword = function() {
        if (self.password1() && self.password2() && self.password1() !== self.password2()) {
            self.passwordWarning(true);
            self.passwordSuccess(false);
        } else if (self.password1() && self.password2() && self.password1() === self.password2()) {
            self.passwordWarning(false);
            self.passwordSuccess(true);
        } else {
            self.passwordWarning(false);
            self.passwordSuccess(false);
        }
        return true;
    };
    
    self.checkUsername = function() {
        if (self.username()) {
            $.ajax({ 
                url: '/marco_profile/duplicate_username', 
                data: { username: self.username() }, 
                method: 'GET',
                dataType: 'json',
                success: function(result) { 
                    if (result.duplicate === true) {
                        self.usernameError(true);
                    } else {
                        self.usernameError(false);
                    }
                },
                error: function(result) { } 
            });
        }
    };
    self.turnOffUsernameError = function() {
        self.usernameError(false);
    };
    
    self.getSeaTurtleAttributes = function (title, data) {
        attrs = [];
        if ('ST_LK_NUM' in data && data['ST_LK_NUM']) {
            //attrs.push({'display': 'Sightings', 'data': data['ST_LK_NUM']});
            if (data['ST_LK_NUM'] === 99) {
                attrs.push({'display': 'Insufficient Data available for this area', 'data': ''});
            } else {
                attrs.push({'display': 'Above Average Sightings for the following species:', 'data': ''});
            }
        } else {
            attrs.push({'display': 'Sightings were in the normal range for all species', 'data': ''});
        }
        
        if ('ST_LK_NUM' in data && data['ST_LK_NUM'] ) {
            if ('GREEN_LK' in data && data['GREEN_LK']) {
                var season = data['GREEN_LK'],
                    species = 'Green Sea Turtle',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }  
            if ('LEATH_LK' in data && data['LEATH_LK']) {
                var season = data['LEATH_LK'],
                    species = 'Leatherback Sea Turtle',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }  
            if ('LOGG_LK' in data && data['LOGG_LK']) {
                var season = data['LOGG_LK'],
                    species = 'Loggerhead Sea Turtle',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }
        }
        return attrs;
    };
    
    self.getToothedMammalAttributes = function (title, data) {
        attrs = [];
        if ('TOO_LK_NUM' in data && data['TOO_LK_NUM']) {
            if (data['TOO_LK_NUM'] === 99) {
                attrs.push({'display': 'Insufficient Data available for this area', 'data': ''});
            } else {
                attrs.push({'display': 'Above Average Sightings for the following species:', 'data': ''});
            }
        } else {
            attrs.push({'display': 'Sightings were in the normal range for all species', 'data': ''});
        }
        if ('TOO_LK_NUM' in data && data['TOO_LK_NUM'] ) {
            if ('SPERM_LK' in data && data['SPERM_LK']) {
                var season = data['SPERM_LK'],
                    species = 'Sperm Whale',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }  
            if ('BND_LK' in data && data['BND_LK']) {
                var season = data['BND_LK'],
                    species = 'Bottlenose Dolphin',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }  
            if ('STRIP_LK' in data && data['STRIP_LK']) {
                var season = data['STRIP_LK'],
                    species = 'Striped Dolphin',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }
        }
        return attrs;
    };
    
    self.getWindSpeedAttributes = function (title, data) {
        attrs = [];
        if ('SPEED_90' in data) {
            var min_speed = (parseFloat(data['SPEED_90'])-.125).toPrecision(3),
                max_speed = (parseFloat(data['SPEED_90'])+.125).toPrecision(3);
            attrs.push({'display': 'Estimated Avg Wind Speed', 'data': min_speed + ' to ' + max_speed + ' m/s'});
        } 
        return attrs;
    };
    
    self.isSelectedLeaseBlock = function(name) {
        if (name === "OCS Lease Blocks") {
            return true;
        }
        if (self.scenarios && 
            self.scenarios.selectionFormModel && 
            self.scenarios.selectionFormModel.selectedLeaseBlockLayer && 
            self.scenarios.selectionFormModel.selectedLeaseBlocksLayerName === name) {
            return true;
        } 
        if (self.scenarios && 
            self.scenarios.scenarioFormModel && 
            self.scenarios.scenarioLeaseBlocksLayerName === name) {
            return true;
        }
        return false;
    };
    
    self.getOCSAttributes = function (title, data) {
        attrs = [];
        if ('BLOCK_LAB' in data) {
            attrs.push({'display': 'OCS Block Number', 'data': data['BLOCK_LAB']});
        } else if ('PROT_NUMB' in data) {
            var blockLab = data['PROT_NUMB'].substring(data['PROT_NUMB'].indexOf('_')+1);
            attrs.push({'display': 'OCS Block Number', 'data': blockLab});
        }
        if ('PROT_NUMBE' in data) {
            attrs.push({'display': 'Protraction Number', 'data': data['PROT_NUMBE']});
        }else if ('PROT_NUMB' in data) {
            var protNumbe = data['PROT_NUMB'].substring(0,data['PROT_NUMB'].indexOf('_'));
            attrs.push({'display': 'Protraction Number', 'data': protNumbe});
        }
        if ('PROT_NUMB' in data) {
            if (self.scenarios && 
                self.scenarios.selectionFormModel && 
                self.scenarios.selectionFormModel.IE && 
                self.scenarios.selectionFormModel.selectingLeaseBlocks()) {
                var blockID = data['PROT_NUMB'],
                    index = self.scenarios.selectionFormModel.selectedLeaseBlocks.indexOf(blockID);
                if ( index === -1) {
                    //add that lease block to the list of selected leaseblocks
                    self.scenarios.selectionFormModel.selectedLeaseBlocks.push(blockID);
                } else {
                    //remove that lease block from the list of selected leaseblocks
                    self.scenarios.selectionFormModel.selectedLeaseBlocks.splice(index, 1);
                }
            }
        }
        //Wind Speed
        if ('WINDREV_MI' in data && 'WINDREV_MA' in data) {
            if ( data['WINDREV_MI'] ) {                
                var min_speed = data['WINDREV_MI'].toFixed(3),
                    max_speed = data['WINDREV_MA'].toFixed(3),
                    min_range = (parseFloat(min_speed)-.125).toPrecision(3),
                    max_range = (parseFloat(max_speed)+.125).toPrecision(3);
                /*if ( min_speed === max_speed ) {
                    attrs.push({'display': 'Estimated Avg Wind Speed (m/s)', 'data': speed});
                } else {
                    var speed = (min_speed-.125) + ' to ' + (max_speed+.125);
                    attrs.push({'display': 'Estimated Avg Wind Speed (m/s)', 'data': speed});
                }*/
                attrs.push({'display': 'Estimated Avg Wind Speed', 'data': min_range + ' to ' + max_range + ' m/s'});
            } else {
                attrs.push({'display': 'Estimated Avg Wind Speed', 'data': 'Unknown'});
            }
        }
        //Distance to Shore
        if ('MI_MIN' in data && 'MI_MAX' in data) {
            attrs.push({'display': 'Distance to Shore', 'data': data['MI_MIN'].toFixed(0) + ' to ' + data['MI_MAX'].toFixed(0) + ' miles'});
        }
        //Depth Range
        if ('DEPTHM_MIN' in data && 'DEPTHM_MAX' in data) {
            if ( data['DEPTHM_MIN'] ) {
                //convert depth values to positive feet values (from negative meter values)
                var max_depth = (-data['DEPTHM_MAX'] * 3.2808399).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                    min_depth = (-data['DEPTHM_MIN'] * 3.2808399).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                attrs.push({'display': 'Depth Range', 'data': max_depth + ' to ' + min_depth + ' feet'});
            } else {
                attrs.push({'display': 'Depth Range', 'data': 'Unknown'});
            }
        }
        //Distance to AWC Hubs
        if ('AWCMI_MIN' in data && 'AWCMI_MAX' in data) {
            attrs.push({'display': 'Distance to Proposed AWC Hub', 'data': data['AWCMI_MIN'].toFixed(0) + ' to ' + data['AWCMI_MAX'].toFixed(0) + ' miles'});
        }
        //Distance to Shipping Lanes
        if ('TRSEP_MIN' in data && 'TRSEP_MAX' in data) {
            attrs.push({'display': 'Distance to Shipping Lanes', 'data': data['TRSEP_MIN'].toFixed(0) + ' to ' + data['TRSEP_MAX'].toFixed(0) + ' miles'});
        }
        //Traffic Density (High/Low)
        if ('AIS7_MEAN' in data) {
            if ( data['AIS7_MEAN'] < 1 ) {
                var rank = 'Low';
            } else {
                var rank = 'High';
            }
            attrs.push({'display': 'Commercial Ship Traffic Density', 'data': rank });
        }
        
        //Coral Count
        var coralCount = 0,
            laceCount = 0,
            blackCount = 0,
            softCount = 0,
            gorgoCount = 0,
            hardCount = 0;
        if ('FREQ_LACE' in data) {
            laceCount = data['FREQ_LACE'];
            coralCount += laceCount;
        }
        if ('FREQ_BLACK' in data) {
            blackCount = data['FREQ_BLACK'];
            coralCount += blackCount;
        }
        if ('FREQ_SOFT' in data) {
            softCount = data['FREQ_SOFT'];
            coralCount += softCount;
        }
        if ('FREQ_GORGO' in data) {
            gorgoCount = data['FREQ_GORGO'];
            coralCount += gorgoCount;
        }
        if ('FREQ_HARD' in data) {
            hardCount = data['FREQ_HARD'];  
            coralCount += hardCount;  
        }
        if (coralCount > 0) {
            attrs.push({'display': 'Corals Identified', 'data': coralCount});
            if (laceCount > 0) {
                attrs.push({'tab': true, 'display': 'Lace Corals (' + laceCount + ')', 'data': ''});
            }
            if (blackCount > 0) {
                attrs.push({'tab': true, 'display': 'Black/Thorny Corals (' + blackCount + ')', 'data': ''});
            }
            if (softCount > 0) {
                attrs.push({'tab': true, 'display': 'Soft Corals (' + softCount + ')', 'data': ''});
            }
            if (gorgoCount > 0) {
                attrs.push({'tab': true, 'display': 'Gorgonian Corals (' + gorgoCount + ')', 'data': ''});
            }
            if (hardCount > 0) {
                attrs.push({'tab': true, 'display': 'Hard Corals (' + hardCount + ')', 'data': ''});
            }
        }
        if ('FREQ_PENS' in data && data['FREQ_PENS'] > 0) {
            var seaPenCount = data['FREQ_PENS'];
            attrs.push({'display': 'Sea Pens Identified', 'data': seaPenCount});
        }
        
        //Seabed Form
        if ('PCT_TOTAL' in data) {
            if (data['PCT_TOTAL'] < 99.9) {
                attrs.push({'display': 'Seabed Form', 'data': 'Unknown'});
            } else {
                attrs.push({'display': 'Seabed Form', 'data': ''});
                if ('PCTDEPRESS' in data && Math.round(data['PCTDEPRESS']) > 0) {
                    attrs.push({'tab': true, 'display': 'Depression (' + Math.round(data['PCTDEPRESS']) + '%)', 'data': ''});
                }
                if ('PCTHIGHFLA' in data && Math.round(data['PCTHIGHFLA']) > 0) {
                    attrs.push({'tab': true, 'display': 'High Flat (' + Math.round(data['PCTHIGHFLA']) + '%)', 'data': ''}); 
                }
                if ('PCTHIGHSLO' in data && Math.round(data['PCTHIGHSLO']) > 0) {
                    attrs.push({'tab': true, 'display': 'High Slope (' + Math.round(data['PCTHIGHSLO']) + '%)', 'data': ''}); 
                }
                if ('PCTLOWSLOP' in data && Math.round(data['PCTLOWSLOP']) > 0) {
                    attrs.push({'tab': true, 'display': 'Low Slope (' + Math.round(data['PCTLOWSLOP']) + '%)', 'data': ''});
                }
                if ('PCTMIDFLAT' in data && Math.round(data['PCTMIDFLAT']) > 0) {
                    attrs.push({'tab': true, 'display': 'Mid Flat (' + Math.round(data['PCTMIDFLAT']) + '%)', 'data': ''});
                }
                if ('PCTSIDESLO' in data && Math.round(data['PCTSIDESLO']) > 0) {
                    attrs.push({'tab': true, 'display': 'Side Slope (' + Math.round(data['PCTSIDESLO']) + '%)', 'data': ''}); 
                }
                if ('PCTSTEEP' in data && Math.round(data['PCTSTEEP']) > 0) {
                    attrs.push({'tab': true, 'display': 'Steep (' + Math.round(data['PCTSTEEP']) + '%)', 'data': ''});
                }
            }
        }
        
        //Distance to Discharge Point Locations
        if ('DISCHMEAN' in data) {
            attrs.push({'display': 'Avg Distance to Offshore Discharge', 'data': data['DISCHMEAN'].toFixed(1) + ' miles'});
        }
        if ('DFLOWMEAN' in data) {
            attrs.push({'display': 'Avg Distance to Flow-Only Offshore Discharge', 'data': data['DFLOWMEAN'].toFixed(1) + ' miles'});
        }
        
        //Dredge Disposal Locations
        if ('DREDGE_LOC' in data) {
            if (data['DREDGE_LOC'] === 1) {
                attrs.push({'display': 'Contains a Dredge Disposal Location', 'data': ''});
            }
        }
        
        //Wind Planning Areas
        /*if ('WEA_NAME' in data) {
            if ( data['WEA_NAME'].replace(/\s+/g, '') !== "" ) {
                attrs.push({'display': 'Part of ' + data['WEA_NAME'] + ' WPA', 'data': null});
            }
        }*/
        return attrs;
    };
            
    return self;
} //end viewModel

app.viewModel = new viewModel();
