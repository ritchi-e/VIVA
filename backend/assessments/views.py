from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from assessments.engine import apply_assessment_modification, finalize_assessment, record_question_override
from assessments.models import Assessment
from assessments.serializers import (
    AssessmentModifySerializer,
    AssessmentSerializer,
    QuestionReviewActionSerializer,
)
from audit import actions as audit_actions
from audit.services import log_audit
from common.permissions import IsInstructorOrAdmin
from common.tenancy import TenantContextMixin
from viva.models import VivaQuestion


class AssessmentViewSet(TenantContextMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AssessmentSerializer

    def get_queryset(self):
        org_id = self.get_organization_id()
        qs = Assessment.objects.filter(
            submission__assignment__course__organization_id=org_id
        ).select_related(
            "submission__student",
            "submission__assignment",
            "viva_session",
        ).prefetch_related("criteria", "criteria__evidence_items")
        role = getattr(self.request.user, "active_role", None)
        if role == "student":
            qs = qs.filter(submission__student=self.request.user)
        submission = self.request.query_params.get("submission")
        if submission:
            qs = qs.filter(submission_id=submission)
        viva_session = self.request.query_params.get("viva_session")
        if viva_session:
            qs = qs.filter(viva_session_id=viva_session)
        return qs

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsInstructorOrAdmin])
    def modify(self, request, pk=None):
        assessment = self.get_object()
        ser = AssessmentModifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        mod = apply_assessment_modification(
            assessment,
            request.user,
            criterion_id=ser.validated_data.get("criterion_id"),
            field_name=ser.validated_data["field_name"],
            new_value=ser.validated_data["new_value"],
            reason=ser.validated_data.get("reason", ""),
        )
        assessment.refresh_from_db()
        log_audit(
            assessment.submission.assignment.course.organization,
            request.user,
            audit_actions.ASSESSMENT_MODIFY,
            "assessment",
            str(assessment.id),
            request=request,
            metadata={"modification_id": str(mod.id)},
        )
        return Response(AssessmentSerializer(assessment).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsInstructorOrAdmin])
    def finalize(self, request, pk=None):
        assessment = self.get_object()
        notes = request.data.get("instructor_notes")
        finalize_assessment(assessment, request.user, instructor_notes=notes)
        log_audit(
            assessment.submission.assignment.course.organization,
            request.user,
            audit_actions.ASSESSMENT_FINALIZE,
            "assessment",
            str(assessment.id),
            request=request,
        )
        return Response(AssessmentSerializer(assessment).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="question-review",
        permission_classes=[IsAuthenticated, IsInstructorOrAdmin],
    )
    def question_review(self, request, pk=None):
        assessment = self.get_object()
        ser = QuestionReviewActionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            question = VivaQuestion.objects.get(
                pk=ser.validated_data["viva_question_id"],
                session_id=assessment.viva_session_id,
            )
        except VivaQuestion.DoesNotExist:
            return Response({"detail": "Question not found for this assessment."}, status=status.HTTP_404_NOT_FOUND)

        attempt = question.attempts.order_by("-attempt_number").first()
        answer = attempt.answers.order_by("-submitted_at").first() if attempt else None
        evaluation = answer.current_evaluation if answer else None
        mod = record_question_override(
            assessment,
            request.user,
            viva_question=question,
            action=ser.validated_data["action"],
            new_value=ser.validated_data.get("new_value"),
            reason=ser.validated_data.get("reason", ""),
            answer_evaluation=evaluation,
        )
        log_audit(
            assessment.submission.assignment.course.organization,
            request.user,
            audit_actions.ASSESSMENT_QUESTION_REVIEW,
            "assessment",
            str(assessment.id),
            request=request,
            metadata={
                "modification_id": str(mod.id),
                "viva_question_id": str(question.id),
                "action": mod.action,
            },
        )
        assessment.refresh_from_db()
        return Response(AssessmentSerializer(assessment).data)
