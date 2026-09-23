from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from audit.services import log_audit
from common.permissions import IsInstructorOrAdmin
from common.tenancy import TenantContextMixin, TenantQuerysetMixin
from courses.join_codes import allocate_join_code
from courses.models import Course, CourseEnrollment
from courses.serializers import CourseEnrollmentSerializer, CourseSerializer
from orgs.models import Membership


class CourseViewSet(TenantContextMixin, TenantQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CourseSerializer
    organization_lookup = "organization_id"
    filterset_fields = ("is_active", "term", "code")
    search_fields = ("title", "code", "description", "join_code")

    def get_permissions(self):
        if self.action == "join":
            return [IsAuthenticated()]
        if self.action in (
            "create",
            "update",
            "partial_update",
            "destroy",
            "enrollments",
            "regenerate_join_code",
        ):
            return [IsAuthenticated(), IsInstructorOrAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        qs = Course.objects.select_related("organization", "created_by")
        role = getattr(self.request.user, "active_role", None)
        if self.action == "join":
            return qs
        qs = self.filter_queryset_by_tenant(qs)
        if role == Membership.Role.STUDENT:
            qs = qs.filter(enrollments__user=self.request.user).distinct()
        return qs

    def perform_create(self, serializer):
        with transaction.atomic():
            course = serializer.save(
                organization_id=self.get_organization_id(),
                created_by=self.request.user,
            )
            CourseEnrollment.objects.get_or_create(
                course=course,
                user=self.request.user,
                defaults={"role": CourseEnrollment.Role.INSTRUCTOR},
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

    @action(detail=True, methods=["post"], url_path="regenerate-join-code")
    def regenerate_join_code(self, request, pk=None):
        course = self.get_object()
        course.join_code = allocate_join_code()
        course.save(update_fields=["join_code", "updated_at"])
        log_audit(
            course.organization,
            request.user,
            "course.regenerate_join_code",
            "course",
            str(course.id),
            request=request,
        )
        return Response(CourseSerializer(course).data)

    @action(detail=False, methods=["post"], url_path="join")
    def join(self, request):
        """Students join a course with a Classroom-style share code."""
        raw = (request.data.get("code") or request.data.get("join_code") or "").strip().upper()
        if not raw:
            return Response({"detail": "Enter a course code."}, status=status.HTTP_400_BAD_REQUEST)

        course = (
            Course.objects.filter(join_code__iexact=raw, is_active=True)
            .select_related("organization")
            .first()
        )
        if not course:
            return Response({"detail": "Invalid course code."}, status=status.HTTP_404_NOT_FOUND)

        created_membership = False
        created_enrollment = False

        with transaction.atomic():
            membership = Membership.all_objects.filter(
                organization=course.organization, user=request.user
            ).first()
            if membership is None:
                Membership.objects.create(
                    organization=course.organization,
                    user=request.user,
                    role=Membership.Role.STUDENT,
                    is_active=True,
                )
                created_membership = True
            else:
                updates = []
                if membership.is_deleted:
                    membership.is_deleted = False
                    membership.deleted_at = None
                    updates.extend(["is_deleted", "deleted_at"])
                    created_membership = True
                if not membership.is_active:
                    membership.is_active = True
                    updates.append("is_active")
                if updates:
                    updates.append("updated_at")
                    membership.save(update_fields=updates)

            enrollment = CourseEnrollment.all_objects.filter(course=course, user=request.user).first()
            if enrollment is None:
                CourseEnrollment.objects.create(
                    course=course,
                    user=request.user,
                    role=CourseEnrollment.Role.STUDENT,
                )
                created_enrollment = True
            elif enrollment.is_deleted:
                enrollment.is_deleted = False
                enrollment.deleted_at = None
                enrollment.role = CourseEnrollment.Role.STUDENT
                enrollment.save(update_fields=["is_deleted", "deleted_at", "role", "updated_at"])
                created_enrollment = True

        log_audit(
            course.organization,
            request.user,
            "course.join",
            "course",
            str(course.id),
            request=request,
            metadata={"created_membership": created_membership, "created_enrollment": created_enrollment},
        )

        return Response(
            {
                "course": CourseSerializer(course).data,
                "organization_id": str(course.organization_id),
                "organization_name": course.organization.name,
                "already_enrolled": not created_enrollment,
            }
        )
