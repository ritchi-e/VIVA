from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from assessments.engine import apply_assessment_modification, finalize_assessment
from assessments.models import Assessment
from assessments.serializers import AssessmentModifySerializer, AssessmentSerializer
from audit.services import log_audit
from common.permissions import IsInstructorOrAdmin
from common.tenancy import TenantContextMixin


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
        ).prefetch_related("criteria")
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
            "assessment.modify",
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
            "assessment.finalize",
            "assessment",
            str(assessment.id),
            request=request,
        )
        return Response(AssessmentSerializer(assessment).data)
