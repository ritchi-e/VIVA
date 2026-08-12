from rest_framework import serializers

from accounts.serializers import UserSerializer
from courses.models import Course, CourseEnrollment


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = (
            "id",
            "organization",
            "code",
            "title",
            "description",
            "term",
            "is_active",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_by", "created_at", "updated_at")


class CourseEnrollmentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = CourseEnrollment
        fields = ("id", "course", "user", "user_id", "role", "created_at")
        read_only_fields = ("id", "course", "user", "created_at")
