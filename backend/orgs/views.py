from django.db.models import Avg, Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from assessments.models import Assessment
from assignments.models import Assignment
from audit.services import log_audit
from common.permissions import IsOrgAdmin
from common.tenancy import TenantContextMixin, TenantQuerysetMixin, resolve_tenant_context
from courses.models import Course
from orgs.models import Membership, Organization
from orgs.serializers import (
    MembershipSerializer,
    OrganizationCreateSerializer,
    OrganizationSerializer,
)
from submissions.models import Submission
from viva.models import VivaSession


class OrganizationViewSet(TenantContextMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Organization.objects.all()
        org_ids = Membership.objects.filter(user=self.request.user, is_active=True).values_list(
            "organization_id", flat=True
        )
        return Organization.objects.filter(id__in=org_ids)

    def get_serializer_class(self):
        if self.action == "create":
            return OrganizationCreateSerializer
        return OrganizationSerializer

    def perform_create(self, serializer):
        org = serializer.save()
        Membership.objects.create(
            organization=org,
            user=self.request.user,
            role=Membership.Role.ORGANIZATION_ADMIN,
        )
        log_audit(org, self.request.user, "org.create", "organization", str(org.id), request=self.request)

    @action(detail=True, methods=["get", "post"], url_path="memberships")
    def memberships(self, request, pk=None):
        org = self.get_object()
        if request.method == "GET":
            qs = Membership.objects.filter(organization=org).select_related("user")
            return Response(MembershipSerializer(qs, many=True).data)
        if not IsOrgAdmin().has_permission(request, self):
            return Response({"message": "Admin required"}, status=status.HTTP_403_FORBIDDEN)
        ser = MembershipSerializer(data=request.data, context={"organization": org})
        ser.is_valid(raise_exception=True)
        membership = ser.save()
        log_audit(org, request.user, "org.membership.create", "membership", str(membership.id), request=request)
        return Response(MembershipSerializer(membership).data, status=status.HTTP_201_CREATED)


class MembershipViewSet(TenantContextMixin, TenantQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOrgAdmin]
    serializer_class = MembershipSerializer
    organization_lookup = "organization_id"
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = Membership.objects.select_related("user", "organization")
        return self.filter_queryset_by_tenant(qs)

    def perform_update(self, serializer):
        membership = serializer.save()
        log_audit(
            membership.organization,
            self.request.user,
            "org.membership.update",
            "membership",
            str(membership.id),
            request=self.request,
        )

    def perform_destroy(self, instance):
        org = instance.organization
        mid = str(instance.id)
        instance.delete()
        log_audit(org, self.request.user, "org.membership.delete", "membership", mid, request=self.request)


def _org_id_or_400(request):
    resolve_tenant_context(request)
    org_id = request.user.active_organization_id
    if not org_id:
        return None, Response({"message": "X-Organization-ID header is required"}, status=status.HTTP_400_BAD_REQUEST)
    return org_id, None


def _serialize_recent_session(session: VivaSession) -> dict:
    return {
        "id": str(session.id),
        "state": session.state,
        "mode": session.mode,
        "student_id": str(session.student_id),
        "student_email": session.student.email,
        "student_name": session.student.full_name or session.student.email,
        "assignment_id": str(session.assignment_id),
        "assignment_title": session.assignment.title,
        "submission_id": str(session.submission_id),
        "questions_asked": session.questions_asked,
        "question_budget": session.question_budget,
        "started_at": session.started_at,
        "completed_at": session.completed_at,
        "created_at": session.created_at,
    }


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_id, error = _org_id_or_400(request)
        if error:
            return error

        assignments = Assignment.objects.filter(course__organization_id=org_id)
        submissions = Submission.objects.filter(assignment__course__organization_id=org_id)
        sessions = VivaSession.objects.filter(assignment__course__organization_id=org_id)
        assessments = Assessment.objects.filter(submission__assignment__course__organization_id=org_id)

        pending_review = assessments.filter(
            status__in=[Assessment.Status.PENDING_REVIEW, Assessment.Status.DRAFT, Assessment.Status.MODIFIED]
        ).count()

        avg = assessments.exclude(overall_score__isnull=True).aggregate(v=Avg("overall_score"))["v"]
        distribution = (
            assessments.exclude(overall_score__isnull=True)
            .values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )

        recent_sessions_qs = (
            sessions.select_related("student", "assignment", "submission")
            .order_by("-created_at")[:10]
        )

        return Response(
            {
                "courses_count": Course.objects.filter(organization_id=org_id).count(),
                "assignments_count": assignments.count(),
                "submissions_count": submissions.count(),
                "viva_sessions_count": sessions.count(),
                "pending_reviews_count": pending_review,
                "students_count": Membership.objects.filter(
                    organization_id=org_id,
                    role=Membership.Role.STUDENT,
                    is_active=True,
                ).count(),
                "active_assignments": assignments.filter(status=Assignment.Status.PUBLISHED).count(),
                "pending_submissions": submissions.filter(
                    status__in=[Submission.Status.UPLOADED, Submission.Status.QUEUED, Submission.Status.PROCESSING]
                ).count(),
                "viva_completion": {
                    "completed": sessions.filter(state=VivaSession.State.COMPLETED).count(),
                    "in_progress": sessions.filter(state=VivaSession.State.IN_PROGRESS).count(),
                    "failed": sessions.filter(state=VivaSession.State.FAILED).count(),
                    "total": sessions.count(),
                },
                "average_assessment": round(float(avg), 2) if avg is not None else None,
                "assessment_distribution": list(distribution),
                "students_requiring_review": pending_review,
                "recent_sessions": [_serialize_recent_session(s) for s in recent_sessions_qs],
            }
        )


class StudentDashboardListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_id, error = _org_id_or_400(request)
        if error:
            return error

        role_filter = request.query_params.get("role", Membership.Role.STUDENT)
        memberships = (
            Membership.objects.filter(
                organization_id=org_id,
                role=role_filter,
                is_active=True,
            )
            .select_related("user")
            .order_by("user__full_name", "user__email")
        )

        results = []
        for membership in memberships:
            user = membership.user
            submissions_count = Submission.objects.filter(
                student=user,
                assignment__course__organization_id=org_id,
            ).count()
            viva_count = VivaSession.objects.filter(
                student=user,
                assignment__course__organization_id=org_id,
            ).count()
            results.append(
                {
                    "id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name or user.email,
                    "role": membership.role,
                    "submissions_count": submissions_count,
                    "viva_sessions_count": viva_count,
                    "membership_id": str(membership.id),
                }
            )
        return Response(results)


class StudentDashboardDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        org_id, error = _org_id_or_400(request)
        if error:
            return error

        membership = (
            Membership.objects.filter(
                organization_id=org_id,
                user_id=user_id,
                is_active=True,
            )
            .select_related("user")
            .first()
        )
        if not membership:
            return Response({"message": "Student not found in this organization."}, status=status.HTTP_404_NOT_FOUND)

        user = membership.user
        submissions_count = Submission.objects.filter(
            student=user,
            assignment__course__organization_id=org_id,
        ).count()
        viva_count = VivaSession.objects.filter(
            student=user,
            assignment__course__organization_id=org_id,
        ).count()
        assessments_pending = Assessment.objects.filter(
            submission__student=user,
            submission__assignment__course__organization_id=org_id,
            status__in=[Assessment.Status.PENDING_REVIEW, Assessment.Status.DRAFT, Assessment.Status.MODIFIED],
        ).count()

        return Response(
            {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name or user.email,
                "role": membership.role,
                "submissions_count": submissions_count,
                "viva_sessions_count": viva_count,
                "pending_reviews_count": assessments_pending,
                "membership_id": str(membership.id),
            }
        )
