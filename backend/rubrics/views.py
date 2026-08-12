from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from assignments.models import Assignment
from audit.services import log_audit
from common.permissions import IsInstructorOrAdmin
from common.tenancy import TenantContextMixin
from rubrics.models import Rubric, RubricCriterion
from rubrics.serializers import (
    RubricCriterionCreateSerializer,
    RubricCriterionSerializer,
    RubricSerializer,
)


class RubricViewSet(TenantContextMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = RubricSerializer

    def get_queryset(self):
        org_id = self.get_organization_id()
        return Rubric.objects.filter(assignment__course__organization_id=org_id).prefetch_related("criteria")

    def perform_create(self, serializer):
        assignment_id = self.request.data.get("assignment")
        assignment = Assignment.objects.get(pk=assignment_id, course__organization_id=self.get_organization_id())
        rubric = serializer.save(assignment=assignment)
        log_audit(
            assignment.course.organization,
            self.request.user,
            "rubric.create",
            "rubric",
            str(rubric.id),
            request=self.request,
        )

    @action(detail=True, methods=["get", "post"], url_path="criteria")
    def criteria(self, request, pk=None):
        rubric = self.get_object()
        if request.method == "GET":
            return Response(RubricCriterionSerializer(rubric.criteria.all(), many=True).data)
        ser = RubricCriterionCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        criterion = RubricCriterion.objects.create(rubric=rubric, **ser.validated_data)
        return Response(RubricCriterionSerializer(criterion).data, status=status.HTTP_201_CREATED)


class RubricCriterionViewSet(TenantContextMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = RubricCriterionSerializer
    http_method_names = ["get", "patch", "delete", "put", "head", "options"]

    def get_queryset(self):
        org_id = self.get_organization_id()
        return RubricCriterion.objects.filter(rubric__assignment__course__organization_id=org_id)
