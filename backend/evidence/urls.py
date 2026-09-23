from django.urls import include, path
from rest_framework.routers import DefaultRouter

from evidence.views import (
    EvidenceFlagViewSet,
    QuestionEvidenceDetailView,
    SubmissionCoverageView,
    SubmissionEvidenceDashboardView,
)

router = DefaultRouter()
router.register("flags", EvidenceFlagViewSet, basename="evidence-flags")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "submissions/<uuid:submission_id>/dashboard/",
        SubmissionEvidenceDashboardView.as_view(),
        name="evidence-dashboard",
    ),
    path(
        "submissions/<uuid:submission_id>/coverage/",
        SubmissionCoverageView.as_view(),
        name="evidence-coverage",
    ),
    path(
        "questions/<uuid:question_id>/detail/",
        QuestionEvidenceDetailView.as_view(),
        name="evidence-question-detail",
    ),
]
