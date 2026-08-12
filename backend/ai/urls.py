from django.urls import path

from ai.views import AIUsageMetricsView

urlpatterns = [
    path("usage/", AIUsageMetricsView.as_view(), name="ai-usage"),
]
