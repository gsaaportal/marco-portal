from django.conf.urls.defaults import *
from django.contrib import admin
from django.views.generic.simple import redirect_to
from django.conf import settings
from django.views.generic.simple import direct_to_template
admin.autodiscover()

urlpatterns = patterns('',
    (r'^about/', direct_to_template, {'template': 'news/about.html'}),
    (r'^marco_profile/', include('marco_profile.urls')),
    (r'^sdc/', include('scenarios.urls')),
    (r'^drawing/', include('drawing.urls')),
    (r'^data_manager/', include('data_manager.urls')),
    (r'^learn/', include('learn.urls')),
    (r'^scenario/', include('scenarios.urls')),
    (r'^explore/', include('explore.urls')),
    (r'^proxy/', include('proxy.urls')),
    (r'^visualize/', include('visualize.urls')),
    (r'^planner/', include('visualize.urls')),
    (r'^embed/', include('visualize.urls')),
    (r'^mobile/', include('visualize.urls')),
    (r'^feedback/', include('feedback.urls')),
    (r'^search/', include('search.urls')),
    (r'^portal/', direct_to_template, {'template': 'home.html'}),
    (r'^$', direct_to_template, {'template': 'home.html'}),
    (r'', include('madrona.common.urls')),
)


if settings.DEBUG:
    urlpatterns += patterns('',
        url(r'^media/(?P<path>.*)$', 'django.views.static.serve', {
            'document_root': settings.MEDIA_ROOT,
        }),
    )
