# Django settings for lot project.
from madrona.common.default_settings import *

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TIME_ZONE = 'America/New_York'
ROOT_URLCONF = 'urls' # 'marco.urls'
LOGIN_REDIRECT_URL = '/visualize'

DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'gsaa',
        'USER': 'vagrant',
    }
}

COMPRESS_CSS['application']['source_filenames'] += (
    'marco/css/analysis_reports.css',
    'kmltree/dist/kmltree_mod.css',
)

COMPRESS_JS['application']['source_filenames'] += (
    'marco/js/jquery.qtip-1.0.0-rc3.min.js',
    #'marco/js/mColorPicker.js',
)

LOG_FILE =  os.path.realpath(os.path.join(os.path.dirname(__file__), '..', 'marco.log'))


INSTALLED_APPS += ( 'clipping',
                    'general',
                    'scenarios',
                    'drawing',
                    'reports',
                    'data_manager',
                    'learn',
                    'explore',
                    'visualize',
                    'feedback',
                    'search',
                    'django.contrib.humanize',
                    'flatblocks',
                    'marco_profile')

#GOOGLE_ANALYTICS_MODEL = True

GEOMETRY_DB_SRID = 99996
GEOMETRY_CLIENT_SRID = 3857 #for latlon
GEOJSON_SRID = 3857

#See the settings_local.py file for the SMTP credentials.
APP_NAME = "GSAA Portal"
FEEDBACK_RECIPIENT = "gsaaportal@gmail.com"
HELP_EMAIL = "gsaaportal@gmail.com"
DEFAULT_FROM_EMAIL = "GSAA Portal Team <gsaaportal@gmail.com>"
FEEDBACK_SUBJECT = "GSAA Portal Feedback"

# url for socket.io printing
#SOCKET_URL = 'http://gsaaportal.org:8080'

# Change the following line to True, to display the 'under maintenance' template
UNDER_MAINTENANCE_TEMPLATE = False

TEMPLATE_DIRS = ( os.path.realpath(os.path.join(os.path.dirname(__file__), 'templates').replace('\\','/')), )

import logging
logging.getLogger('django.db.backends').setLevel(logging.ERROR)

from settings_local import *
