from django.conf.urls.defaults import *
from views import *
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('',
    url(r'^poly_results$', direct_to_template, {'template' : 'polygon-query-results.html'}),
    url(r'^get_bookmarks$', get_bookmarks),
    url(r'^remove_bookmark$', remove_bookmark),
    url(r'^add_bookmark$', add_bookmark),
    url(r'^get_sharing_groups$', get_sharing_groups),
    url(r'share_bookmark$', share_bookmark),
    (r'^map', show_embedded_map),
    (r'^mobile', show_mobile_map),
    (r'^create_polygon_query_client_file', create_polygon_query_client_file),
    (r'', show_planner),
)
