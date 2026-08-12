from django.urls import include, path
from rest_framework.routers import DefaultRouter

from rubrics.views import RubricCriterionViewSet, RubricViewSet

router = DefaultRouter()
router.register("criteria", RubricCriterionViewSet, basename="rubric-criterion")
router.register("", RubricViewSet, basename="rubric")

urlpatterns = [
    path("", include(router.urls)),
]
