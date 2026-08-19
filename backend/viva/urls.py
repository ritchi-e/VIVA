from django.urls import include, path
from rest_framework.routers import DefaultRouter

from viva.slot_views import VivaSlotViewSet
from viva.views import VivaSessionViewSet

router = DefaultRouter()
router.register("sessions", VivaSessionViewSet, basename="viva-session")
router.register("slots", VivaSlotViewSet, basename="viva-slot")

urlpatterns = [
    path("", include(router.urls)),
]
