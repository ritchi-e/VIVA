from rest_framework import serializers

from accounts.models import User
from accounts.services import provision_personal_workspace
from orgs.models import Membership


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "full_name", "email_verified", "avatar_url", "date_joined")
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    full_name = serializers.CharField(required=False, allow_blank=True)
    organization_name = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=Membership.Role.choices,
        default=Membership.Role.INSTRUCTOR,
    )

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already registered")
        return value.lower()

    def create(self, validated_data):
        org_name = validated_data.pop("organization_name", "") or "Personal Workspace"
        role = validated_data.pop("role", Membership.Role.INSTRUCTOR)
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data.get("full_name", ""),
        )
        membership = provision_personal_workspace(user, role=role, organization_name=org_name)
        user._created_organization = membership.organization
        user._created_role = role
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    organization_id = serializers.UUIDField(required=False)


class MembershipSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    organization_slug = serializers.CharField(source="organization.slug", read_only=True)

    class Meta:
        model = Membership
        fields = (
            "id",
            "organization",
            "organization_name",
            "organization_slug",
            "role",
            "is_active",
            "created_at",
        )
        read_only_fields = fields


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
