

/**
 * Show shadow under header when scroll position
 * is not at the top.
 */
// $(document).ready(function () {

//     var header = $('header');

//     $(window).scroll(function(e){
//         if(header.offset().top !== 0){
//             if(!header.hasClass('shadow')){
//                 console.log('+ shadow');
//                 header.addClass('shadow');
//             }
//         }else{
//             console.log('- shadow');
//             header.removeClass('shadow');
//         }
//     });
// });

/**
 * Toggle search form display.
 */
$(document).ready(function () {
    var searchFormSelector = '.navbar .navbar-form.search';
    var searchForm = $(searchFormSelector);
    var searchButton = $(searchFormSelector + ' .btn');
    var searchInput = $(searchFormSelector + ' input');

    $(searchButton).click(function() {
        if (searchForm.hasClass('active')) {
            // Hide.
            searchForm.removeClass('active');
            searchInput.css({'display': 'none'});
            searchForm.animate({ width: 44 }, 200);
        } else {
            // Show.
            searchForm.addClass('active');
            searchForm.animate({
                width: 400
            }, 200, function () {
                // animation complete, show textbox and set focus
                searchInput.css({'display': 'inline'}).trigger('focus');
            });
        }
    });
});

/**
 * Navigation highlighting.
 */
$(document).ready(function () {
    // highlight active top level
    $('.sidebar-nav-section > h3 > a[href*="' + location.pathname.split("/")[1] + '"][class!="noselect"]').each(function () {
        $(this).parents('.sidebar-nav-section').addClass('active');
    });
});

/**
 * Home page carousel
 */
$(document).ready(function () {
    $('#homeCarousel').carousel({
        interval: 4000
    });

    $('#homeCarousel .carousel-indicators li').click(function () {
        var that = $(this);

        $('#homeCarousel .carousel-indicators li').removeClass('active');
        setTimeout(function () {
            that.addClass('active');
        }, 10);
    });

    $('.info-button').tooltip({
        html: true,
        placement: 'top'
    });
});


/*
 * Replace all SVG images with inline SVG allowing us to change the color, size, etc
 * with css like so:
 *
 * #img-tag-id:hover path {
 *   fill: red;
 * }
 *
 * OR
 *
 * .img-tag-class:hover path {
 *   fill: red;
 * }
 *
 * http://stackoverflow.com/questions/11978995/how-to-change-color-of-svg-image-using-css-jquery-svg-image-replacement
 *
 */
$(document).ready(function () {
    jQuery('img.svg').each(function(){
        var $img = jQuery(this);
        var imgID = $img.attr('id');
        var imgClass = $img.attr('class');
        var imgURL = $img.attr('src');

        jQuery.get(imgURL, function(data) {
            // Get the SVG tag, ignore the rest
            var $svg = jQuery(data).find('svg');

            // Add replaced image's ID to the new SVG
            if(typeof imgID !== 'undefined') {
                $svg = $svg.attr('id', imgID);
            }
            // Add replaced image's classes to the new SVG
            if(typeof imgClass !== 'undefined') {
                $svg = $svg.attr('class', imgClass+' replaced-svg');
            }

            // Remove any invalid XML tags as per http://validator.w3.org
            $svg = $svg.removeAttr('xmlns:a');

            // Replace image with new SVG
            $img.replaceWith($svg);
        });

    });
});



/**
 * Compensate for the fixed header when scrolling to mid-page anchors.
 */

$(document).ready(function () {
    var hash = window.location.hash,
        offsettop = $('header').height(),
        speed = 300;
    if (hash !== '') {
      $('html,body').animate({scrollTop: $(hash).offset().top - offsettop}, speed);
    }
});

