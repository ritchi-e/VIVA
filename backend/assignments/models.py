from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class Assignment(UUIDModel, SoftDeleteModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        CLOSED = "closed", "Closed"

    course = models.ForeignKey("courses.Course", on_delete=models.CASCADE, related_name="assignments")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    instructions = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.DRAFT)
    due_at = models.DateTimeField(null=True, blank=True)
    allow_pdf = models.BooleanField(default=True)
    allow_docx = models.BooleanField(default=True)
    allow_pptx = models.BooleanField(default=True)
    allow_github = models.BooleanField(default=True)
    allow_zip = models.BooleanField(default=True)
    viva_config = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_assignments",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["course", "status"])]

    def __str__(self):
        return self.title

    @property
    def organization_id(self):
        return self.course.organization_id


class LearningOutcome(UUIDModel, SoftDeleteModel):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="learning_outcomes")
    code = models.CharField(max_length=32)
    description = models.TextField()
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "code"]
        unique_together = ("assignment", "code")
