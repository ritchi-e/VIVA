from rest_framework import serializers

from audit.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source="actor.email", read_only=True)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "organization",
            "actor",
            "actor_email",
            "action",
            "resource_type",
            "resource_id",
            "ip_address",
            "metadata",
            "created_at",
        )
        read_only_fields = fields
