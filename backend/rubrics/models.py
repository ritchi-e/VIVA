from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class Rubric(UUIDModel, SoftDeleteModel):
    assignment = models.OneToOneField(
        "assignments.Assignment",
        on_delete=models.CASCADE,
        related_name="rubric",
    )
    title = models.CharField(max_length=255, default="Assessment Rubric")
    description = models.TextField(blank=True)

    def __str__(self):
        return self.title


class RubricCriterion(UUIDModel, SoftDeleteModel):
    rubric = models.ForeignKey(Rubric, on_delete=models.CASCADE, related_name="criteria")
    learning_outcome = models.ForeignKey(
        "assignments.LearningOutcome",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="criteria",
    )
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=1)
    max_score = models.DecimalField(max_digits=6, decimal_places=2, default=10)
    order = models.PositiveIntegerField(default=0)
    category = models.CharField(
        max_length=64,
        blank=True,
        help_text="e.g. conceptual, methodology, implementation, results, critical_thinking, communication",
    )

    class Meta:
        ordering = ["order", "name"]
