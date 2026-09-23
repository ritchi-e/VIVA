from rest_framework import serializers

from evidence.models import EvidenceFlag


class EvidenceFlagSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvidenceFlag
        fields = (
            "id",
            "viva_session",
            "viva_question",
            "answer",
            "flag_type",
            "severity",
            "description",
            "supporting_evidence",
            "confidence",
            "status",
            "created_by",
            "resolved_by",
            "resolved_at",
            "resolution_note",
            "created_at",
        )
        read_only_fields = (
            "id",
            "created_by",
            "resolved_by",
            "resolved_at",
            "created_at",
            "status",
        )


class EvidenceFlagCreateSerializer(serializers.Serializer):
    viva_session = serializers.UUIDField()
    viva_question = serializers.UUIDField(required=False, allow_null=True)
    answer = serializers.UUIDField(required=False, allow_null=True)
    flag_type = serializers.ChoiceField(choices=EvidenceFlag.FlagType.choices)
    severity = serializers.ChoiceField(
        choices=EvidenceFlag.Severity.choices,
        required=False,
        default=EvidenceFlag.Severity.MEDIUM,
    )
    description = serializers.CharField()
    supporting_evidence = serializers.JSONField(required=False)
    confidence = serializers.CharField(required=False, allow_blank=True, default="")


class EvidenceFlagResolveSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            EvidenceFlag.Status.CONFIRMED,
            EvidenceFlag.Status.DISMISSED,
            EvidenceFlag.Status.RESOLVED,
        ]
    )
    resolution_note = serializers.CharField(required=False, allow_blank=True, default="")
