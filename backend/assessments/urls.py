from django.urls import include, path
from rest_framework.routers import DefaultRouter

from assessments.views import AssessmentViewSet

router = DefaultRouter()
router.register("", AssessmentViewSet, basename="assessment")

urlpatterns = [
    path("", include(router.urls)),
]
