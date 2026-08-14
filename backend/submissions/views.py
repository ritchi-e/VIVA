from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from audit.services import log_audit
from common.permissions import IsInstructorOrAdmin, IsStudent
from common.tenancy import TenantContextMixin
from submissions.models import Submission
from submissions.serializers import SubmissionCreateSerializer, SubmissionSerializer


class SubmissionViewSet(TenantContextMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return SubmissionCreateSerializer
        return SubmissionSerializer

    def get_queryset(self):
        org_id = self.get_organization_id()
        qs = Submission.objects.filter(assignment__course__organization_id=org_id).select_related(
            "assignment", "student", "repository"
        ).prefetch_related("files", "repository__files")
        role = getattr(self.request.user, "active_role", None)
        if role == "student":
            qs = qs.filter(student=self.request.user)
        assignment_id = self.request.query_params.get("assignment")
        student_id = self.request.query_params.get("student")
        if assignment_id:
            qs = qs.filter(assignment_id=assignment_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        return qs.order_by("-created_at")

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsStudent()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = serializer.save()
        log_audit(
            submission.assignment.course.organization,
            request.user,
            "submission.create",
            "submission",
            str(submission.id),
            request=request,
        )
        return Response(SubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="status")
    def status_detail(self, request, pk=None):
        from django.core.exceptions import ObjectDoesNotExist

        submission = self.get_object()
        try:
            repository = submission.repository
        except ObjectDoesNotExist:
            repository = None
        repo_payload = None
        if repository:
            repo_payload = {
                "owner": repository.owner,
                "repo": repository.repo,
                "commit_sha": repository.commit_sha,
                "status": repository.status,
                "files_indexed": repository.files_indexed,
                "files_skipped": repository.files_skipped,
                "stack": (repository.project_profile or {}).get("stack") or [],
            }
        return Response(
            {
                "id": str(submission.id),
                "status": submission.status,
                "stage": submission.processing_stage,
                "error": submission.processing_error,
                "files_indexed": repository.files_indexed if repository else None,
                "files_skipped": repository.files_skipped if repository else None,
                "repository": repo_payload,
            }
        )
