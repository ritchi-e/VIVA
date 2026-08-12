from django.urls import include, path
from rest_framework.routers import DefaultRouter

from submissions.views import SubmissionViewSet

router = DefaultRouter()
router.register("", SubmissionViewSet, basename="submission")

urlpatterns = [
    path("", include(router.urls)),
]
