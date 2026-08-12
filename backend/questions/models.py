from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class QuestionPlan(UUIDModel, SoftDeleteModel):
    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.CASCADE,
        related_name="question_plans",
    )
    viva_session = models.ForeignKey(
        "viva.VivaSession",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="question_plans",
    )
    plan = models.JSONField(default=dict, blank=True)
    coverage = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=32, default="ready")


class PlannedQuestion(UUIDModel, SoftDeleteModel):
    class QuestionType(models.TextChoices):
        CONCEPTUAL = "conceptual", "Conceptual"
        SUBMISSION_SPECIFIC = "submission_specific", "Submission-specific"
        METHODOLOGY = "methodology", "Methodology"
        IMPLEMENTATION = "implementation", "Implementation"
        RESULTS = "results", "Results interpretation"
        CRITICAL = "critical_thinking", "Critical thinking"
        COUNTERFACTUAL = "counterfactual", "Counterfactual"
        APPLICATION = "application", "Application"
        DEFENSE = "defense", "Defense/justification"
        LIMITATIONS = "limitations", "Limitations"

    plan = models.ForeignKey(QuestionPlan, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveIntegerField(default=0)
    question_type = models.CharField(max_length=32, choices=QuestionType.choices)
    difficulty = models.CharField(max_length=16, default="medium")
    rubric_criterion = models.ForeignKey(
        "rubrics.RubricCriterion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    learning_outcome = models.ForeignKey(
        "assignments.LearningOutcome",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    concept = models.CharField(max_length=512, blank=True)
    purpose = models.TextField(blank=True)
    expected_evidence = models.TextField(blank=True)
    source_artifact = models.CharField(max_length=255, blank=True)
    source_ref = models.CharField(max_length=512, blank=True)
    wording = models.TextField(blank=True)
    is_follow_up = models.BooleanField(default=False)
    parent_question = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="follow_ups",
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["order"]
