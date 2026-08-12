from rest_framework import serializers

from accounts.serializers import UserSerializer
from orgs.models import Membership, Organization


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("id", "name", "slug", "settings", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class OrganizationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("name", "slug", "settings")

    def validate_slug(self, value):
        if Organization.objects.filter(slug=value).exists():
            raise serializers.ValidationError("Slug already in use")
        return value


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True, required=False)
    user_email = serializers.EmailField(write_only=True, required=False)

    class Meta:
        model = Membership
        fields = (
            "id",
            "organization",
            "user",
            "user_id",
            "user_email",
            "role",
            "is_active",
            "created_at",
        )
        read_only_fields = ("id", "organization", "user", "created_at")

    def create(self, validated_data):
        from accounts.models import User

        org = self.context["organization"]
        user_id = validated_data.pop("user_id", None)
        user_email = validated_data.pop("user_email", None)
        user = None
        if user_id:
            user = User.objects.filter(pk=user_id).first()
        elif user_email:
            user = User.objects.filter(email__iexact=user_email).first()
        if not user:
            raise serializers.ValidationError("user_id or user_email required and must exist")
        return Membership.objects.create(organization=org, user=user, **validated_data)
