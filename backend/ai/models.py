from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class AIModel(UUIDModel, SoftDeleteModel):
    provider = models.CharField(max_length=64)
    name = models.CharField(max_length=128)
    model_type = models.CharField(max_length=32)  # chat, embedding, stt, tts
    is_active = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ("provider", "name", "model_type")


class AIRequest(UUIDModel, SoftDeleteModel):
    provider = models.CharField(max_length=64)
    model = models.CharField(max_length=128)
    request_type = models.CharField(max_length=64)
    organization = models.ForeignKey(
        "orgs.Organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_requests",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_requests",
    )
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    estimated_cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    latency_ms = models.PositiveIntegerField(default=0)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["provider", "request_type"]),
            models.Index(fields=["organization", "created_at"]),
        ]


class AIUsage(UUIDModel, SoftDeleteModel):
    organization = models.ForeignKey(
        "orgs.Organization",
        on_delete=models.CASCADE,
        related_name="ai_usage",
    )
    period_start = models.DateField()
    period_end = models.DateField()
    total_requests = models.PositiveIntegerField(default=0)
    total_input_tokens = models.PositiveIntegerField(default=0)
    total_output_tokens = models.PositiveIntegerField(default=0)
    total_cost_usd = models.DecimalField(max_digits=12, decimal_places=6, default=0)

    class Meta:
        unique_together = ("organization", "period_start", "period_end")
