from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

from common.models import SoftDeleteModel, UUIDModel


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, username=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra_fields)


class User(UUIDModel, SoftDeleteModel, AbstractUser):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    email_verified = models.BooleanField(default=False)
    avatar_url = models.URLField(blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        indexes = [models.Index(fields=["email"])]

    def __str__(self):
        return self.email

    @property
    def active_organization_id(self):
        return getattr(self, "_active_organization_id", None)

    @active_organization_id.setter
    def active_organization_id(self, value):
        self._active_organization_id = value

    @property
    def active_role(self):
        return getattr(self, "_active_role", None)

    @active_role.setter
    def active_role(self, value):
        self._active_role = value
