from django.urls import include, path
from rest_framework.routers import DefaultRouter

from assignments.views import AssignmentViewSet

router = DefaultRouter()
router.register("", AssignmentViewSet, basename="assignment")

urlpatterns = [
    path("", include(router.urls)),
]
