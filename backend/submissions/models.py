from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class Submission(UUIDModel, SoftDeleteModel):
    class Status(models.TextChoices):
        UPLOADED = "uploaded", "Uploaded"
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    class ProcessingStage(models.TextChoices):
        QUEUED = "queued", "Queued"
        FETCHING_REPOSITORY = "fetching_repository", "Fetching repository"
        INDEXING_FILES = "indexing_files", "Indexing files"
        ANALYZING_STRUCTURE = "analyzing_structure", "Analyzing structure"
        EMBEDDING_EVIDENCE = "embedding_evidence", "Embedding evidence"
        BUILDING_QUESTION_CONTEXT = "building_question_context", "Building question context"
        COMPLETE = "complete", "Complete"
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
    processing_stage = models.CharField(
        max_length=48,
        choices=ProcessingStage.choices,
        default=ProcessingStage.QUEUED,
        blank=True,
    )
    github_url = models.URLField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    knowledge_representation = models.JSONField(default=dict, blank=True)
    processing_error = models.TextField(blank=True)
    assignment_mismatch = models.BooleanField(default=False)
    assignment_mismatch_reason = models.TextField(blank=True)
    assignment_alignment_score = models.FloatField(null=True, blank=True)
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


class RepositorySnapshot(UUIDModel, SoftDeleteModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        FETCHING = "fetching", "Fetching"
        INDEXED = "indexed", "Indexed"
        FAILED = "failed", "Failed"

    submission = models.OneToOneField(Submission, on_delete=models.CASCADE, related_name="repository")
    github_url = models.URLField()
    owner = models.CharField(max_length=128)
    repo = models.CharField(max_length=256)
    default_branch = models.CharField(max_length=256, blank=True)
    commit_sha = models.CharField(max_length=64, blank=True, db_index=True)
    archive_storage_key = models.CharField(max_length=1024, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING)
    files_indexed = models.PositiveIntegerField(default=0)
    files_skipped = models.PositiveIntegerField(default=0)
    total_bytes = models.BigIntegerField(default=0)
    extracted_chars = models.PositiveIntegerField(default=0)
    project_profile = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    stage_timings = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [models.Index(fields=["owner", "repo", "commit_sha"])]


class RepositoryFile(UUIDModel, SoftDeleteModel):
    class Category(models.TextChoices):
        SOURCE = "source", "Source"
        DOCUMENTATION = "documentation", "Documentation"
        CONFIGURATION = "configuration", "Configuration"
        TEST = "test", "Test"
        GENERATED = "generated", "Generated"
        BINARY = "binary", "Binary"
        DATASET = "dataset", "Dataset"
        UNSUPPORTED = "unsupported", "Unsupported"

    snapshot = models.ForeignKey(RepositorySnapshot, on_delete=models.CASCADE, related_name="files")
    path = models.CharField(max_length=1024)
    language = models.CharField(max_length=32, blank=True)
    category = models.CharField(max_length=32, choices=Category.choices, default=Category.UNSUPPORTED)
    size_bytes = models.BigIntegerField(default=0)
    content_hash = models.CharField(max_length=64, blank=True, db_index=True)
    indexed = models.BooleanField(default=False)
    skip_reason = models.CharField(max_length=128, blank=True)
    extracted_text = models.TextField(blank=True)

    class Meta:
        unique_together = ("snapshot", "path")
        indexes = [models.Index(fields=["snapshot", "indexed"])]


class CodeSymbol(UUIDModel, SoftDeleteModel):
    class Kind(models.TextChoices):
        FUNCTION = "function", "Function"
        CLASS = "class", "Class"
        METHOD = "method", "Method"
        IMPORT = "import", "Import"
        ROUTE = "route", "Route"
        MODEL = "model", "Model"
        OTHER = "other", "Other"

    snapshot = models.ForeignKey(RepositorySnapshot, on_delete=models.CASCADE, related_name="symbols")
    repository_file = models.ForeignKey(RepositoryFile, on_delete=models.CASCADE, related_name="symbols")
    name = models.CharField(max_length=256)
    kind = models.CharField(max_length=32, choices=Kind.choices, default=Kind.OTHER)
    signature = models.CharField(max_length=1024, blank=True)
    docstring = models.TextField(blank=True)
    start_line = models.PositiveIntegerField(default=1)
    end_line = models.PositiveIntegerField(default=1)
    language = models.CharField(max_length=32, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["snapshot", "kind"]),
            models.Index(fields=["repository_file", "start_line"]),
        ]


class CodeDependency(UUIDModel, SoftDeleteModel):
    class Kind(models.TextChoices):
        IMPORT = "import", "Import"
        CALL = "call", "Call"
        UNRESOLVED = "unresolved", "Unresolved"

    snapshot = models.ForeignKey(RepositorySnapshot, on_delete=models.CASCADE, related_name="dependencies")
    from_file = models.ForeignKey(
        RepositoryFile,
        on_delete=models.CASCADE,
        related_name="outbound_dependencies",
    )
    to_file = models.ForeignKey(
        RepositoryFile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inbound_dependencies",
    )
    from_symbol = models.ForeignKey(
        CodeSymbol,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="outbound_edges",
    )
    to_symbol = models.ForeignKey(
        CodeSymbol,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inbound_edges",
    )
    from_path = models.CharField(max_length=1024)
    to_path = models.CharField(max_length=1024, blank=True)
    kind = models.CharField(max_length=32, choices=Kind.choices, default=Kind.IMPORT)
    resolved = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)


class SubmissionChunk(UUIDModel, SoftDeleteModel):
    class ChunkKind(models.TextChoices):
        FUNCTION = "function", "Function"
        CLASS = "class", "Class"
        METHOD = "method", "Method"
        DOCUMENT = "document", "Document"
        CONFIG = "config", "Config"
        FALLBACK = "fallback", "Fallback"

    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="chunks")
    file = models.ForeignKey(
        SubmissionFile,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="chunks",
    )
    repository_file = models.ForeignKey(
        RepositoryFile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chunks",
    )
    chunk_index = models.PositiveIntegerField()
    content = models.TextField()
    token_count = models.PositiveIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    source_ref = models.CharField(max_length=512, blank=True)
    path = models.CharField(max_length=1024, blank=True)
    language = models.CharField(max_length=32, blank=True)
    symbol = models.CharField(max_length=256, blank=True)
    start_line = models.PositiveIntegerField(null=True, blank=True)
    end_line = models.PositiveIntegerField(null=True, blank=True)
    content_hash = models.CharField(max_length=64, blank=True, db_index=True)
    chunk_kind = models.CharField(max_length=32, choices=ChunkKind.choices, default=ChunkKind.FALLBACK)
    # JSON fallback for SQLite tests; pgvector column is maintained separately on Postgres.
    embedding = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["chunk_index"]
        indexes = [
            models.Index(fields=["submission", "chunk_index"]),
            models.Index(fields=["submission", "path"]),
        ]


class QuestionCandidate(UUIDModel, SoftDeleteModel):
    class Level(models.TextChoices):
        PROJECT = "project", "Project"
        IMPLEMENTATION = "implementation", "Implementation"
        FOLLOW_UP = "follow_up", "Follow-up seed"

    snapshot = models.ForeignKey(
        RepositorySnapshot,
        on_delete=models.CASCADE,
        related_name="question_candidates",
        null=True,
        blank=True,
    )
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="question_candidates")
    level = models.CharField(max_length=32, choices=Level.choices, default=Level.IMPLEMENTATION)
    question_type = models.CharField(max_length=64, blank=True)
    prompt_hint = models.TextField()
    evidence_chunk_ids = models.JSONField(default=list, blank=True)
    source_ref = models.CharField(max_length=512, blank=True)
    start_line = models.PositiveIntegerField(null=True, blank=True)
    end_line = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)


class EmbeddingCache(UUIDModel):
    content_hash = models.CharField(max_length=64, db_index=True)
    embedding_model = models.CharField(max_length=128)
    vector = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("content_hash", "embedding_model")


class SubmissionVersion(UUIDModel, SoftDeleteModel):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ("submission", "version_number")


class PlagiarismReport(UUIDModel, SoftDeleteModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETE = "complete", "Complete"
        SKIPPED = "skipped", "Skipped"

    submission = models.OneToOneField(
        Submission,
        on_delete=models.CASCADE,
        related_name="plagiarism_report",
    )
    viva_session = models.ForeignKey(
        "viva.VivaSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="plagiarism_reports",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    checked_at = models.DateTimeField(null=True, blank=True)
    plagiarism_detected = models.BooleanField(default=False)
    highest_similarity = models.FloatField(default=0.0)
    peer_count = models.PositiveIntegerField(default=0)
    summary = models.TextField(blank=True)
    matches = models.JSONField(default=list, blank=True)

    class Meta:
        indexes = [models.Index(fields=["plagiarism_detected", "checked_at"])]
