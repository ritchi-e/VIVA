from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from audit import actions as audit_actions
from audit.services import log_audit
from common.permissions import IsInstructorOrAdmin
from common.tenancy import TenantContextMixin
from evidence.models import EvidenceFlag
from evidence.serializers import (
    EvidenceFlagCreateSerializer,
    EvidenceFlagResolveSerializer,
    EvidenceFlagSerializer,
)
from evidence.services import (
    build_dashboard,
    build_question_detail,
    create_flag,
    derive_coverage,
    resolve_flag,
)
from submissions.models import Submission
from viva.models import VivaQuestion, VivaSession


class EvidenceFlagViewSet(TenantContextMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = EvidenceFlagSerializer

    def get_queryset(self):
        org_id = self.get_organization_id()
        return EvidenceFlag.objects.filter(
            viva_session__assignment__course__organization_id=org_id,
        ).select_related("viva_session", "viva_question", "answer")

    def create(self, request):
        ser = EvidenceFlagCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        org_id = self.get_organization_id()
        try:
            session = VivaSession.objects.get(
                pk=ser.validated_data["viva_session"],
                assignment__course__organization_id=org_id,
            )
        except VivaSession.DoesNotExist:
            return Response({"detail": "Viva session not found."}, status=status.HTTP_404_NOT_FOUND)
        flag = create_flag(session=session, user=request.user, data=ser.validated_data)
        log_audit(
            session.assignment.course.organization,
            request.user,
            audit_actions.EVIDENCE_FLAG_CREATED,
            "evidence_flag",
            str(flag.id),
            request=request,
            metadata={"flag_type": flag.flag_type, "viva_session": str(session.id)},
        )
        return Response(EvidenceFlagSerializer(flag).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        flag = self.get_queryset().filter(pk=pk).first()
        if not flag:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = EvidenceFlagResolveSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        resolve_flag(
            flag=flag,
            user=request.user,
            status=ser.validated_data["status"],
            note=ser.validated_data.get("resolution_note", ""),
        )
        log_audit(
            flag.viva_session.assignment.course.organization,
            request.user,
            audit_actions.EVIDENCE_FLAG_RESOLVED,
            "evidence_flag",
            str(flag.id),
            request=request,
            metadata={"status": flag.status},
        )
        return Response(EvidenceFlagSerializer(flag).data)


class SubmissionEvidenceDashboardView(TenantContextMixin, APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request, submission_id):
        org_id = self.get_organization_id()
        submission = Submission.objects.filter(
            pk=submission_id,
            assignment__course__organization_id=org_id,
        ).select_related("student", "assignment").first()
        if not submission:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(build_dashboard(submission))


class SubmissionCoverageView(TenantContextMixin, APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request, submission_id):
        org_id = self.get_organization_id()
        submission = Submission.objects.filter(
            pk=submission_id,
            assignment__course__organization_id=org_id,
        ).first()
        if not submission:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"coverage": derive_coverage(submission)})


class QuestionEvidenceDetailView(TenantContextMixin, APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request, question_id):
        org_id = self.get_organization_id()
        question = (
            VivaQuestion.objects.filter(
                pk=question_id,
                session__assignment__course__organization_id=org_id,
            )
            .select_related("planned_question", "session", "source_chunk")
            .prefetch_related("attempts__answers__evaluations", "planned_question__follow_ups")
            .first()
        )
        if not question:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(build_question_detail(question))
