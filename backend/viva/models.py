from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class VivaSession(UUIDModel, SoftDeleteModel):
    class State(models.TextChoices):
        CREATED = "CREATED", "Created"
        PREPARING = "PREPARING", "Preparing"
        READY = "READY", "Ready"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        PAUSED = "PAUSED", "Paused"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"
        REVIEW_REQUIRED = "REVIEW_REQUIRED", "Review Required"

    class Mode(models.TextChoices):
        TEXT = "text", "Text"
        VOICE = "voice", "Voice"

    assignment = models.ForeignKey(
        "assignments.Assignment",
        on_delete=models.CASCADE,
        related_name="viva_sessions",
    )
    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.CASCADE,
        related_name="viva_sessions",
    )
    student = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="viva_sessions",
    )
    state = models.CharField(max_length=32, choices=State.choices, default=State.CREATED)
    mode = models.CharField(max_length=16, choices=Mode.choices, default=Mode.TEXT)
    understanding_state = models.JSONField(default=dict, blank=True)
    coverage_state = models.JSONField(default=dict, blank=True)
    question_budget = models.PositiveIntegerField(default=8)
    questions_asked = models.PositiveIntegerField(default=0)
    time_limit_seconds = models.PositiveIntegerField(default=1800)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    config = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["student", "state"]),
            models.Index(fields=["assignment", "state"]),
        ]

    @property
    def organization_id(self):
        return self.assignment.course.organization_id


class VivaQuestion(UUIDModel, SoftDeleteModel):
    session = models.ForeignKey(VivaSession, on_delete=models.CASCADE, related_name="questions")
    planned_question = models.ForeignKey(
        "questions.PlannedQuestion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    sequence = models.PositiveIntegerField()
    question_text = models.TextField()
    question_type = models.CharField(max_length=32, blank=True)
    provenance = models.JSONField(default=dict, blank=True)
    asked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sequence"]
        unique_together = ("session", "sequence")


class QuestionAttempt(UUIDModel, SoftDeleteModel):
    question = models.ForeignKey(VivaQuestion, on_delete=models.CASCADE, related_name="attempts")
    attempt_number = models.PositiveIntegerField(default=1)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)


class StudentAnswer(UUIDModel, SoftDeleteModel):
    attempt = models.ForeignKey(QuestionAttempt, on_delete=models.CASCADE, related_name="answers")
    text = models.TextField()
    input_mode = models.CharField(max_length=16, default="text")
    audio_storage_key = models.CharField(max_length=1024, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)


class AnswerEvaluation(UUIDModel, SoftDeleteModel):
    answer = models.OneToOneField(StudentAnswer, on_delete=models.CASCADE, related_name="evaluation")
    conceptual_accuracy = models.FloatField(default=0)
    evidence_support = models.FloatField(default=0)
    depth = models.FloatField(default=0)
    relevance = models.FloatField(default=0)
    overall = models.FloatField(default=0)
    requires_follow_up = models.BooleanField(default=False)
    explanation = models.TextField(blank=True)
    evidence_refs = models.JSONField(default=list, blank=True)
    raw = models.JSONField(default=dict, blank=True)
    is_ai_generated = models.BooleanField(default=True)


class VivaIntegrityEvent(UUIDModel, SoftDeleteModel):
    class EventType(models.TextChoices):
        TAB_HIDDEN = "tab_hidden", "Tab hidden"
        TAB_RETURNED = "tab_returned", "Tab returned"
        GRACE_EXPIRED = "grace_expired", "Grace expired"
        CAMERA_DENIED = "camera_denied", "Camera denied"
        FRAME_UPLOADED = "frame_uploaded", "Frame uploaded"
        FULLSCREEN_LEFT = "fullscreen_left", "Fullscreen left"

    session = models.ForeignKey(VivaSession, on_delete=models.CASCADE, related_name="integrity_events")
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    client_ts = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["session", "event_type"]),
        ]


class VivaSlotBooking(UUIDModel, SoftDeleteModel):
    class Status(models.TextChoices):
        BOOKED = "booked", "Booked"
        STARTED = "started", "Started"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        NO_SHOW = "no_show", "No-show"

    student = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="slot_bookings")
    assignment = models.ForeignKey("assignments.Assignment", on_delete=models.CASCADE, related_name="slot_bookings")
    submission = models.ForeignKey("submissions.Submission", on_delete=models.CASCADE, related_name="slot_bookings")
    slot_start = models.DateTimeField()
    slot_end = models.DateTimeField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.BOOKED)
    viva_session = models.OneToOneField(
        "viva.VivaSession", on_delete=models.SET_NULL, null=True, blank=True, related_name="slot_booking",
    )

    class Meta:
        ordering = ["slot_start"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "assignment"],
                condition=models.Q(is_deleted=False, status__in=["booked", "started"]),
                name="unique_active_booking_per_student_assignment",
            ),
        ]
        indexes = [
            models.Index(fields=["slot_start", "status"], name="viva_vivasl_slot_st_idx"),
        ]

    def __str__(self):
        return f"{self.student} | {self.slot_start:%Y-%m-%d %H:%M} | {self.status}"


class VivaProctorFrame(UUIDModel, SoftDeleteModel):
    session = models.ForeignKey(VivaSession, on_delete=models.CASCADE, related_name="proctor_frames")
    storage_key = models.CharField(max_length=1024)
    captured_at = models.DateTimeField(auto_now_add=True)
    content_type = models.CharField(max_length=64, default="image/jpeg")
    byte_size = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["captured_at"]
        indexes = [
            models.Index(fields=["session", "captured_at"]),
        ]

