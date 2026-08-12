from rest_framework import serializers

from assessments.models import Assessment, AssessmentCriterion
from viva.models import AnswerEvaluation, VivaQuestion


class AssessmentCriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentCriterion
        fields = (
            "id",
            "name",
            "category",
            "ai_score",
            "instructor_score",
            "final_score",
            "max_score",
            "weight",
            "confidence",
            "explanation",
            "ai_explanation",
        )
        read_only_fields = ("id",)


class AssessmentQuestionReviewSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    sequence = serializers.IntegerField()
    question_text = serializers.CharField()
    question_type = serializers.CharField()
    concept = serializers.CharField(allow_blank=True)
    answer_text = serializers.CharField(allow_blank=True, allow_null=True)
    input_mode = serializers.CharField(allow_blank=True, allow_null=True)
    answered_at = serializers.DateTimeField(allow_null=True)
    evaluation_overall = serializers.FloatField(allow_null=True)
    evaluation_explanation = serializers.CharField(allow_blank=True, allow_null=True)
    conceptual_accuracy = serializers.FloatField(allow_null=True)
    evidence_support = serializers.FloatField(allow_null=True)
    depth = serializers.FloatField(allow_null=True)
    relevance = serializers.FloatField(allow_null=True)
    requires_follow_up = serializers.BooleanField(allow_null=True)


class AssessmentSerializer(serializers.ModelSerializer):
    criteria = AssessmentCriterionSerializer(many=True, read_only=True)
    question_reviews = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    assignment_title = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = (
            "id",
            "viva_session",
            "submission",
            "status",
            "overall_score",
            "ai_overall_score",
            "strengths",
            "weaknesses",
            "evidence_summary",
            "areas_requiring_review",
            "unanswered_areas",
            "recommended_followups",
            "disclaimer",
            "reviewed_by",
            "reviewed_at",
            "finalized_at",
            "instructor_notes",
            "criteria",
            "question_reviews",
            "student_name",
            "assignment_title",
            "created_at",
        )
        read_only_fields = fields

    def get_student_name(self, obj):
        student = obj.submission.student
        return student.full_name or student.email

    def get_assignment_title(self, obj):
        return obj.submission.assignment.title

    def get_question_reviews(self, obj):
        if not obj.viva_session_id:
            return []
        questions = (
            VivaQuestion.objects.filter(session_id=obj.viva_session_id)
            .prefetch_related("attempts__answers__evaluation")
            .order_by("sequence")
        )
        reviews = []
        for question in questions:
            provenance = question.provenance or {}
            attempt = question.attempts.order_by("-attempt_number").first()
            answer = attempt.answers.order_by("-submitted_at").first() if attempt else None
            evaluation = None
            if answer:
                try:
                    evaluation = answer.evaluation
                except AnswerEvaluation.DoesNotExist:
                    evaluation = None
            reviews.append(
                {
                    "question_id": question.id,
                    "sequence": question.sequence,
                    "question_text": question.question_text,
                    "question_type": question.question_type,
                    "concept": provenance.get("concept") or "",
                    "answer_text": answer.text if answer else None,
                    "input_mode": answer.input_mode if answer else None,
                    "answered_at": answer.submitted_at if answer else None,
                    "evaluation_overall": evaluation.overall if evaluation else None,
                    "evaluation_explanation": evaluation.explanation if evaluation else None,
                    "conceptual_accuracy": evaluation.conceptual_accuracy if evaluation else None,
                    "evidence_support": evaluation.evidence_support if evaluation else None,
                    "depth": evaluation.depth if evaluation else None,
                    "relevance": evaluation.relevance if evaluation else None,
                    "requires_follow_up": evaluation.requires_follow_up if evaluation else None,
                }
            )
        return AssessmentQuestionReviewSerializer(reviews, many=True).data


class AssessmentModifySerializer(serializers.Serializer):
    field_name = serializers.ChoiceField(choices=["overall_score", "instructor_score", "instructor_notes"])
    criterion_id = serializers.UUIDField(required=False)
    new_value = serializers.JSONField()
    reason = serializers.CharField(required=False, allow_blank=True)
