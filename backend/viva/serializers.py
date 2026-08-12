from rest_framework import serializers

from viva.models import AnswerEvaluation, StudentAnswer, VivaQuestion, VivaSession


class AnswerEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerEvaluation
        fields = (
            "id",
            "conceptual_accuracy",
            "evidence_support",
            "depth",
            "relevance",
            "overall",
            "requires_follow_up",
            "explanation",
        )
        read_only_fields = fields


class StudentAnswerSerializer(serializers.ModelSerializer):
    evaluation = AnswerEvaluationSerializer(read_only=True)

    class Meta:
        model = StudentAnswer
        fields = (
            "id",
            "text",
            "input_mode",
            "submitted_at",
            "evaluation",
        )
        read_only_fields = fields


class VivaQuestionSerializer(serializers.ModelSerializer):
    student_answer = serializers.SerializerMethodField()
    concept = serializers.SerializerMethodField()
    source_ref = serializers.SerializerMethodField()
    excerpt = serializers.SerializerMethodField()

    class Meta:
        model = VivaQuestion
        fields = (
            "id",
            "sequence",
            "question_text",
            "question_type",
            "concept",
            "source_ref",
            "excerpt",
            "asked_at",
            "student_answer",
        )
        read_only_fields = fields

    def get_concept(self, obj):
        provenance = obj.provenance or {}
        return provenance.get("concept") or ""

    def get_source_ref(self, obj):
        provenance = obj.provenance or {}
        excerpt = provenance.get("excerpt") or {}
        return excerpt.get("source_ref") or provenance.get("source_ref") or ""

    def get_excerpt(self, obj):
        provenance = obj.provenance or {}
        excerpt = provenance.get("excerpt")
        if isinstance(excerpt, dict) and excerpt.get("quote"):
            return {
                "quote": excerpt.get("quote") or "",
                "source_ref": excerpt.get("source_ref") or "",
                "chunk_id": excerpt.get("chunk_id") or "",
            }
        return None

    def get_student_answer(self, obj):
        attempt = obj.attempts.order_by("-attempt_number").first()
        if not attempt:
            return None
        answer = attempt.answers.order_by("-submitted_at").first()
        if not answer:
            return None
        return StudentAnswerSerializer(answer).data


class VivaSessionSerializer(serializers.ModelSerializer):
    questions = VivaQuestionSerializer(many=True, read_only=True)
    student_email = serializers.EmailField(source="student.email", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)

    class Meta:
        model = VivaSession
        fields = (
            "id",
            "assignment",
            "assignment_title",
            "submission",
            "student",
            "student_email",
            "student_name",
            "state",
            "mode",
            "question_budget",
            "questions_asked",
            "time_limit_seconds",
            "started_at",
            "completed_at",
            "error_message",
            "questions",
            "created_at",
        )
        read_only_fields = (
            "id",
            "student",
            "state",
            "questions_asked",
            "started_at",
            "completed_at",
            "error_message",
            "questions",
            "created_at",
        )


class VivaSessionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = VivaSession
        fields = (
            "id",
            "assignment",
            "submission",
            "mode",
            "question_budget",
            "time_limit_seconds",
            "config",
            "state",
        )
        read_only_fields = ("id", "state")


class AnswerSubmitSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    text = serializers.CharField()
    input_mode = serializers.CharField(default="text")
