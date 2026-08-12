from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class Organization(UUIDModel, SoftDeleteModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Membership(UUIDModel, SoftDeleteModel):
    class Role(models.TextChoices):
        ORGANIZATION_ADMIN = "organization_admin", "Organization Admin"
        INSTRUCTOR = "instructor", "Instructor"
        STUDENT = "student", "Student"
        VIEWER = "viewer", "Viewer"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=32, choices=Role.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("organization", "user")
        indexes = [
            models.Index(fields=["organization", "role"]),
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user.email} @ {self.organization.slug} ({self.role})"
