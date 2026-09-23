from django.db import models

from common.models import SoftDeleteModel, UUIDModel
from courses.join_codes import allocate_join_code


class Course(UUIDModel, SoftDeleteModel):
    organization = models.ForeignKey("orgs.Organization", on_delete=models.CASCADE, related_name="courses")
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    term = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)
    join_code = models.CharField(
        max_length=16,
        unique=True,
        db_index=True,
        help_text="Shareable code students use to join this course (Classroom-style).",
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_courses",
    )

    class Meta:
        unique_together = ("organization", "code", "term")
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "is_active"])]

    def __str__(self):
        return f"{self.code} — {self.title}"

    def ensure_join_code(self, *, force: bool = False) -> str:
        if self.join_code and not force:
            return self.join_code
        self.join_code = allocate_join_code(model=type(self))
        return self.join_code

    def save(self, *args, **kwargs):
        if not self.join_code:
            self.join_code = allocate_join_code(model=type(self))
        super().save(*args, **kwargs)


class CourseEnrollment(UUIDModel, SoftDeleteModel):
    class Role(models.TextChoices):
        INSTRUCTOR = "instructor", "Instructor"
        STUDENT = "student", "Student"
        TA = "ta", "Teaching Assistant"

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="course_enrollments")
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.STUDENT)

    class Meta:
        unique_together = ("course", "user")
