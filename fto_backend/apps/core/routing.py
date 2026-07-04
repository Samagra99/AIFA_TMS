from django.urls import re_path
from apps.core.consumers import FleetStatusConsumer, BaseConsumer

websocket_urlpatterns = [
    re_path(r"ws/fleet/$",            FleetStatusConsumer.as_asgi()),
    re_path(r"ws/base/(?P<base_id>[^/]+)/$", BaseConsumer.as_asgi()),
]
