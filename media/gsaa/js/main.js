

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
