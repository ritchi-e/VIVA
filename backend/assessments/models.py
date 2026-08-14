from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class Assessment(UUIDModel, SoftDeleteModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "AI Draft"
        PENDING_REVIEW = "pending_review", "Pending Instructor Review"
        MODIFIED = "modified", "Modified by Instructor"
        FINALIZED = "finalized", "Finalized"

    viva_session = models.OneToOneField(
        "viva.VivaSession",
        on_delete=models.CASCADE,
        related_name="assessment",
    )
    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.CASCADE,
        related_name="assessments",
    )
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.DRAFT)
    overall_score = models.FloatField(null=True, blank=True)
    ai_overall_score = models.FloatField(null=True, blank=True)
    strengths = models.JSONField(default=list, blank=True)
    weaknesses = models.JSONField(default=list, blank=True)
    evidence_summary = models.TextField(blank=True)
    areas_requiring_review = models.JSONField(default=list, blank=True)
    unanswered_areas = models.JSONField(default=list, blank=True)
    recommended_followups = models.JSONField(default=list, blank=True)
    disclaimer = models.CharField(
        max_length=255,
        default="AI assessment of submitted-implementation understanding. Instructor review required.",
    )
    reviewed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_assessments",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    finalized_at = models.DateTimeField(null=True, blank=True)
    instructor_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]


class AssessmentCriterion(UUIDModel, SoftDeleteModel):
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name="criteria")
    rubric_criterion = models.ForeignKey(
        "rubrics.RubricCriterion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=128)
    category = models.CharField(max_length=64, blank=True)
    ai_score = models.FloatField(null=True, blank=True)
    instructor_score = models.FloatField(null=True, blank=True)
    final_score = models.FloatField(null=True, blank=True)
    max_score = models.FloatField(default=10)
    weight = models.FloatField(default=1)
    confidence = models.FloatField(default=0.5)
    explanation = models.TextField(blank=True)
    ai_explanation = models.TextField(blank=True)


class AssessmentEvidence(UUIDModel, SoftDeleteModel):
    criterion = models.ForeignKey(
        AssessmentCriterion,
        on_delete=models.CASCADE,
        related_name="evidence_items",
    )
    answer = models.ForeignKey(
        "viva.StudentAnswer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    source_ref = models.CharField(max_length=512, blank=True)
    quote = models.TextField(blank=True)
    note = models.TextField(blank=True)


class AssessmentModification(UUIDModel, SoftDeleteModel):
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name="modifications")
    criterion = models.ForeignKey(
        AssessmentCriterion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    reviewer = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True)
    field_name = models.CharField(max_length=64)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    reason = models.TextField(blank=True)
