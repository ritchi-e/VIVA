from django.contrib import admin

from ai.models import AIModel, AIRequest, AIUsage


@admin.register(AIModel)
class AIModelAdmin(admin.ModelAdmin):
    list_display = ("provider", "name", "model_type", "is_active")


@admin.register(AIRequest)
class AIRequestAdmin(admin.ModelAdmin):
    list_display = ("provider", "request_type", "organization", "success", "created_at")
    list_filter = ("provider", "request_type", "success")


@admin.register(AIUsage)
class AIUsageAdmin(admin.ModelAdmin):
    list_display = ("organization", "period_start", "period_end", "total_requests")
