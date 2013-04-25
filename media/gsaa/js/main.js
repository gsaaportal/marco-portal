

/**
 * Show shadow under header when scroll position 
 * is not at the top.
 */
$(document).ready(function () {

    var header = $('header');

    $(window).scroll(function(e){
        if(header.offset().top !== 0){
            if(!header.hasClass('shadow')){
                console.log('+ shadow');
                header.addClass('shadow');
            }
        }else{
            console.log('- shadow');
            header.removeClass('shadow');
        }
    });
});

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
 * Set page block left margins to one pixel less due to border. 
 * todo: determine which span in each row is tallest and only use a border there to allow
 * for the borders to reach fully to the next row's top border.
 */
$(document).ready(function () {
    $('.page-blocks > .row > [class*="span"]:first-child').css({'margin-right': '-=1'});
    $('.page-blocks > .row > [class*="span"]:last-child').css({'margin-left': '-=1'});
});


