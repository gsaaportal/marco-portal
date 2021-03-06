from fabric.api import *

vars = {
    'app_dir': '/usr/local/apps/geosurvey/server',
    'venv': '/usr/local/apps/geosurvey/geosurvey_env'
}

env.forward_agent = True



def dev():
    """ Use development server settings """
    servers = ['vagrant@127.0.0.1:2222']
    env.hosts = servers
    env.key_filename = '~/.vagrant.d/insecure_private_key'
    vars['app_dir'] = '/vagrant/marco'
    vars['venv'] = '/usr/local/venv/marco'
    return servers


def prod():
    """ Use production server settings """
    servers = []
    env.hosts = servers
    return servers


def test():
    """ Use test server settings """
    servers = ['dionysus']
    env.hosts = servers
    return servers


def all():
    """ Use all servers """
    env.hosts = dev() + prod() + test()



def _install_requirements():
    run('cd %(app_dir)s && %(venv)s/bin/pip install -r ../requirements.txt' % vars)

def _install_django():
    run('cd %(app_dir)s && %(venv)s/bin/python manage.py syncdb --noinput && \
                           %(venv)s/bin/python manage.py migrate --noinput' % vars)


def init():
    """ Initialize the forest planner application """
    _install_requirements()
    _install_django()


def run_server():
	run('cd /vagrant/marco && /usr/local/venv/marco/bin/python manage.py runserver 0.0.0.0:8000')