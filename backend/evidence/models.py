from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class EvidenceFlag(UUIDModel, SoftDeleteModel):
    class FlagType(models.TextChoices):
        INCONSISTENCY = "inconsistency", "Inconsistency"
        INSUFFICIENT_EVIDENCE = "insufficient_evidence", "Insufficient evidence"
        UNSUPPORTED_CLAIM = "unsupported_claim", "Unsupported claim"
        POSSIBLE_MISUNDERSTANDING = "possible_misunderstanding", "Possible misunderstanding"
        REQUIRES_REVIEW = "requires_review", "Requires instructor review"

    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CONFIRMED = "confirmed", "Confirmed"
        DISMISSED = "dismissed", "Dismissed"
        RESOLVED = "resolved", "Resolved"

    viva_session = models.ForeignKey(
        "viva.VivaSession",
        on_delete=models.CASCADE,
        related_name="evidence_flags",
    )
    viva_question = models.ForeignKey(
        "viva.VivaQuestion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evidence_flags",
    )
    answer = models.ForeignKey(
        "viva.StudentAnswer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evidence_flags",
    )
    flag_type = models.CharField(max_length=32, choices=FlagType.choices)
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.MEDIUM)
    description = models.TextField()
    supporting_evidence = models.JSONField(default=list, blank=True)
    confidence = models.CharField(max_length=32, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    resolved_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["viva_session", "status"]),
            models.Index(fields=["flag_type", "severity"]),
        ]
