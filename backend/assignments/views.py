from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from assignments.models import Assignment, LearningOutcome
from assignments.serializers import (
    AssignmentSerializer,
    LearningOutcomeCreateSerializer,
    LearningOutcomeSerializer,
)
from audit.services import log_audit
from common.permissions import IsInstructorOrAdmin
from common.tenancy import TenantContextMixin, TenantQuerysetMixin
from courses.models import Course
from rubrics.models import Rubric
from rubrics.serializers import RubricSerializer


class AssignmentViewSet(TenantContextMixin, TenantQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AssignmentSerializer
    organization_lookup = "course__organization_id"
    filterset_fields = ("status", "course")
    search_fields = ("title", "description")

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "publish", "learning_outcomes"):
            return [IsAuthenticated(), IsInstructorOrAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        org_id = self.get_organization_id()
        qs = Assignment.objects.filter(course__organization_id=org_id).select_related("course", "created_by")
        return qs.prefetch_related("learning_outcomes")

    def perform_create(self, serializer):
        course_id = self.request.data.get("course")
        course = Course.objects.get(pk=course_id, organization_id=self.get_organization_id())
        assignment = serializer.save(course=course, created_by=self.request.user)
        log_audit(
            course.organization,
            self.request.user,
            "assignment.create",
            "assignment",
            str(assignment.id),
            request=self.request,
        )

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        assignment = self.get_object()
        assignment.status = Assignment.Status.PUBLISHED
        assignment.save(update_fields=["status", "updated_at"])
        log_audit(
            assignment.course.organization,
            request.user,
            "assignment.publish",
            "assignment",
            str(assignment.id),
            request=request,
        )
        return Response(AssignmentSerializer(assignment).data)

    @action(detail=True, methods=["get", "post"], url_path="learning-outcomes")
    def learning_outcomes(self, request, pk=None):
        assignment = self.get_object()
        if request.method == "GET":
            return Response(LearningOutcomeSerializer(assignment.learning_outcomes.all(), many=True).data)
        ser = LearningOutcomeCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        lo = LearningOutcome.objects.create(assignment=assignment, **ser.validated_data)
        return Response(LearningOutcomeSerializer(lo).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "put", "patch"], url_path="rubric")
    def rubric(self, request, pk=None):
        assignment = self.get_object()
        rubric, _ = Rubric.objects.get_or_create(assignment=assignment, defaults={"title": f"{assignment.title} Rubric"})
        if request.method == "GET":
            return Response(RubricSerializer(rubric).data)
        ser = RubricSerializer(rubric, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(RubricSerializer(rubric).data)
