from django.contrib import admin
from django.urls import include, path
from django_prometheus import exports

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", include("common.urls")),
    path("api/auth/", include("accounts.urls")),
    path("api/orgs/", include("orgs.urls")),
    path("api/courses/", include("courses.urls")),
    path("api/assignments/", include("assignments.urls")),
    path("api/rubrics/", include("rubrics.urls")),
    path("api/submissions/", include("submissions.urls")),
    path("api/viva/", include("viva.urls")),
    path("api/assessments/", include("assessments.urls")),
    path("api/ai/", include("ai.urls")),
    path("api/audit/", include("audit.urls")),
    path("metrics", exports.ExportToDjangoView, name="prometheus-django-metrics"),
]
