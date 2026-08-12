from django.urls import include, path
from rest_framework.routers import DefaultRouter

from courses.views import CourseViewSet

router = DefaultRouter()
router.register("", CourseViewSet, basename="course")

urlpatterns = [
    path("", include(router.urls)),
]
