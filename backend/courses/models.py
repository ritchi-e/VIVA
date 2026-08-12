from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class Course(UUIDModel, SoftDeleteModel):
    organization = models.ForeignKey("orgs.Organization", on_delete=models.CASCADE, related_name="courses")
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    term = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)
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
