# Create your views here.
from django.shortcuts import get_object_or_404, render_to_response
from django.template import RequestContext
from django.utils import simplejson
from data_manager.models import *
from learn.models import *
from utils import get_domain
import settings


def search(request, template='search_results.html'):
    search_key = request.GET['gsaa-q']
    context = {'search_key': search_key, 'domain': get_domain(8000), 'domain8010': get_domain()}
    return render_to_response(template, RequestContext(request, context)) 
