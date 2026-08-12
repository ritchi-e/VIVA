from django.urls import include, path
from rest_framework.routers import DefaultRouter

from viva.views import VivaSessionViewSet

router = DefaultRouter()
router.register("sessions", VivaSessionViewSet, basename="viva-session")

urlpatterns = [
    path("", include(router.urls)),
]
