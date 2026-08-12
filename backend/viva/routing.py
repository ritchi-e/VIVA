from django.urls import re_path

from viva import consumers

websocket_urlpatterns = [
    re_path(r"ws/viva/(?P<session_id>[0-9a-f-]+)/$", consumers.VivaSessionConsumer.as_asgi()),
]
