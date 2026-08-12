from django.urls import include, path
from rest_framework.routers import DefaultRouter

from orgs.views import (
    DashboardView,
    MembershipViewSet,
    OrganizationViewSet,
    StudentDashboardDetailView,
    StudentDashboardListView,
)

router = DefaultRouter()
router.register("", OrganizationViewSet, basename="organization")
router.register("memberships", MembershipViewSet, basename="membership")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="org-dashboard"),
    path("dashboard/students/", StudentDashboardListView.as_view(), name="org-dashboard-students"),
    path("dashboard/students/<uuid:user_id>/", StudentDashboardDetailView.as_view(), name="org-dashboard-student-detail"),
    path("", include(router.urls)),
]
