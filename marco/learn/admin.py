from django.contrib import admin
from models import * 

class TopicAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'ordering', 'name', 'active')
    search_fields = ['display_name', 'name']
    ordering = ('display_name', 'ordering')
    
    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == 'layers':
            kwargs['queryset'] = Layer.objects.order_by('name')
        return super(TopicAdmin, self).formfield_for_manytomany(db_field, request, **kwargs)

class MapViewAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'topic', 'ordering', 'name', 'active')
    search_fields = ['display_name', 'name', 'topic']
    ordering = ('topic', 'ordering', 'display_name')

admin.site.register(Topic, TopicAdmin)
admin.site.register(MapView, MapViewAdmin)