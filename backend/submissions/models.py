from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class Submission(UUIDModel, SoftDeleteModel):
    class Status(models.TextChoices):
        UPLOADED = "uploaded", "Uploaded"
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    assignment = models.ForeignKey(
        "assignments.Assignment",
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    student = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.UPLOADED)
    github_url = models.URLField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    knowledge_representation = models.JSONField(default=dict, blank=True)
    processing_error = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["assignment", "student"]),
            models.Index(fields=["status"]),
        ]
        unique_together = ("assignment", "student", "version")

    @property
    def organization_id(self):
        return self.assignment.course.organization_id


class SubmissionFile(UUIDModel, SoftDeleteModel):
    class FileType(models.TextChoices):
        PDF = "pdf", "PDF"
        DOCX = "docx", "DOCX"
        PPTX = "pptx", "PPTX"
        ZIP = "zip", "ZIP"
        OTHER = "other", "Other"

    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="files")
    original_filename = models.CharField(max_length=512)
    content_type = models.CharField(max_length=128, blank=True)
    file_type = models.CharField(max_length=16, choices=FileType.choices, default=FileType.OTHER)
    size_bytes = models.BigIntegerField(default=0)
    storage_key = models.CharField(max_length=1024)
    checksum = models.CharField(max_length=128, blank=True)
    extracted_text = models.TextField(blank=True)
    structure = models.JSONField(default=dict, blank=True)


class SubmissionChunk(UUIDModel, SoftDeleteModel):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="chunks")
    file = models.ForeignKey(
        SubmissionFile,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="chunks",
    )
    chunk_index = models.PositiveIntegerField()
    content = models.TextField()
    token_count = models.PositiveIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    source_ref = models.CharField(max_length=512, blank=True)
    # embedding stored via pgvector VectorField when available; JSON fallback for SQLite tests
    embedding = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["chunk_index"]
        indexes = [models.Index(fields=["submission", "chunk_index"])]


class SubmissionVersion(UUIDModel, SoftDeleteModel):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ("submission", "version_number")
