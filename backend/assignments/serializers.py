from rest_framework import serializers

from assignments.models import Assignment, LearningOutcome


class LearningOutcomeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LearningOutcome
        fields = ("id", "assignment", "code", "description", "order")
        read_only_fields = ("id", "assignment")


class AssignmentSerializer(serializers.ModelSerializer):
    learning_outcomes = LearningOutcomeSerializer(many=True, read_only=True)

    class Meta:
        model = Assignment
        fields = (
            "id",
            "course",
            "title",
            "description",
            "instructions",
            "status",
            "due_at",
            "allow_pdf",
            "allow_docx",
            "allow_pptx",
            "allow_github",
            "allow_zip",
            "viva_config",
            "created_by",
            "learning_outcomes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at", "status")


class LearningOutcomeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LearningOutcome
        fields = ("code", "description", "order")
