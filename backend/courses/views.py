from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from audit.services import log_audit
from common.permissions import IsInstructorOrAdmin
from common.tenancy import TenantContextMixin, TenantQuerysetMixin
from courses.models import Course, CourseEnrollment
from courses.serializers import CourseEnrollmentSerializer, CourseSerializer


class CourseViewSet(TenantContextMixin, TenantQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CourseSerializer
    organization_lookup = "organization_id"
    filterset_fields = ("is_active", "term", "code")
    search_fields = ("title", "code", "description")

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "enrollments"):
            return [IsAuthenticated(), IsInstructorOrAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        qs = Course.objects.select_related("organization", "created_by")
        return self.filter_queryset_by_tenant(qs)

    def perform_create(self, serializer):
        course = serializer.save(
            organization_id=self.get_organization_id(),
            created_by=self.request.user,
        )
        log_audit(
            course.organization,
            self.request.user,
            "course.create",
            "course",
            str(course.id),
            request=self.request,
        )

    @action(detail=True, methods=["get", "post"], url_path="enrollments")
    def enrollments(self, request, pk=None):
        course = self.get_object()
        if request.method == "GET":
            qs = CourseEnrollment.objects.filter(course=course).select_related("user")
            return Response(CourseEnrollmentSerializer(qs, many=True).data)
        ser = CourseEnrollmentSerializer(data={**request.data, "course": course.id})
        ser.is_valid(raise_exception=True)
        enrollment = CourseEnrollment.objects.create(
            course=course,
            user_id=ser.validated_data["user_id"],
            role=ser.validated_data.get("role", CourseEnrollment.Role.STUDENT),
        )
        log_audit(
            course.organization,
            request.user,
            "course.enrollment.create",
            "course_enrollment",
            str(enrollment.id),
            request=request,
        )
        return Response(CourseEnrollmentSerializer(enrollment).data, status=status.HTTP_201_CREATED)
