from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from assignments.models import Assignment
from common.permissions import IsInstructorOrAdmin, IsStudent
from common.tenancy import TenantContextMixin
from submissions.models import Submission
from viva.models import VivaSlotBooking
from viva.slot_serializers import (
    BookSlotSerializer,
    SlotWindowSerializer,
    VivaSlotBookingSerializer,
)


def _snap_to_slot(dt, duration_minutes: int):
    """Round a datetime up to the next slot boundary."""
    minute = dt.minute
    remainder = minute % duration_minutes
    if remainder == 0 and dt.second == 0 and dt.microsecond == 0:
        return dt
    snapped = dt.replace(second=0, microsecond=0) + timedelta(minutes=duration_minutes - remainder)
    return snapped


class VivaSlotViewSet(TenantContextMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = VivaSlotBookingSerializer

    def get_permissions(self):
        if self.action == "for_assignment":
            return [IsAuthenticated(), IsInstructorOrAdmin()]
        return [IsAuthenticated(), IsStudent()]

    def get_queryset(self):
        return VivaSlotBooking.objects.filter(student=self.request.user)

    @action(detail=False, methods=["get"], url_path="available")
    def available(self, request):
        """List available slot windows for the next N hours."""
        duration = settings.VIVA_SLOT_DURATION_MINUTES
        capacity = settings.VIVA_MAX_CONCURRENT_SESSIONS
        buffer = settings.VIVA_SLOT_BUFFER_MINUTES
        lookahead = settings.VIVA_SLOT_LOOKAHEAD_HOURS

        now = timezone.now()
        start = _snap_to_slot(now + timedelta(minutes=buffer), duration)
        end = now + timedelta(hours=lookahead)

        windows = []
        cursor = start
        while cursor < end:
            windows.append(cursor)
            cursor += timedelta(minutes=duration)

        counts = dict(
            VivaSlotBooking.objects.filter(
                slot_start__in=windows,
                status__in=[VivaSlotBooking.Status.BOOKED, VivaSlotBooking.Status.STARTED],
                is_deleted=False,
            )
            .values_list("slot_start")
            .annotate(count=Count("id"))
            .values_list("slot_start", "count")
        )

        slots = []
        for w in windows:
            booked = counts.get(w, 0)
            slots.append({
                "slot_start": w,
                "slot_end": w + timedelta(minutes=duration),
                "capacity": capacity,
                "booked": booked,
                "available": max(0, capacity - booked),
            })

        serializer = SlotWindowSerializer(slots, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="book")
    def book(self, request):
        """Book a slot for an assignment."""
        ser = BookSlotSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        assignment_id = ser.validated_data["assignment_id"]
        slot_start = ser.validated_data["slot_start"]

        duration = settings.VIVA_SLOT_DURATION_MINUTES
        capacity = settings.VIVA_MAX_CONCURRENT_SESSIONS
        buffer = settings.VIVA_SLOT_BUFFER_MINUTES

        # Validate slot alignment
        if slot_start.second != 0 or slot_start.microsecond != 0 or slot_start.minute % duration != 0:
            return Response(
                {"detail": f"slot_start must be aligned to {duration}-minute boundaries."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        earliest = _snap_to_slot(now + timedelta(minutes=buffer), duration)
        if slot_start < earliest:
            return Response(
                {"detail": "Slot is in the past or too soon to book."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org_id = self.get_organization_id()
        try:
            assignment = Assignment.objects.get(pk=assignment_id, course__organization_id=org_id)
        except Assignment.DoesNotExist:
            return Response({"detail": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)

        submission = (
            Submission.objects.filter(
                assignment=assignment,
                student=request.user,
                status=Submission.Status.READY,
            )
            .order_by("-created_at")
            .first()
        )
        if not submission:
            return Response(
                {"detail": "You need a processed submission before booking a viva slot."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Check capacity
            booked_count = (
                VivaSlotBooking.objects.select_for_update()
                .filter(
                    slot_start=slot_start,
                    status__in=[VivaSlotBooking.Status.BOOKED, VivaSlotBooking.Status.STARTED],
                    is_deleted=False,
                )
                .count()
            )
            if booked_count >= capacity:
                return Response(
                    {"detail": "This slot is full. Please choose another."},
                    status=status.HTTP_409_CONFLICT,
                )

            # Check student doesn't already have an active booking for this assignment
            existing = VivaSlotBooking.objects.filter(
                student=request.user,
                assignment=assignment,
                status__in=[VivaSlotBooking.Status.BOOKED, VivaSlotBooking.Status.STARTED],
                is_deleted=False,
            ).exists()
            if existing:
                return Response(
                    {"detail": "You already have an active booking for this assignment."},
                    status=status.HTTP_409_CONFLICT,
                )

            booking = VivaSlotBooking.objects.create(
                student=request.user,
                assignment=assignment,
                submission=submission,
                slot_start=slot_start,
                slot_end=slot_start + timedelta(minutes=duration),
            )

        return Response(VivaSlotBookingSerializer(booking).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Cancel a booking (only if still booked and slot hasn't started)."""
        try:
            booking = VivaSlotBooking.objects.get(pk=pk, student=request.user, is_deleted=False)
        except VivaSlotBooking.DoesNotExist:
            return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        if booking.status != VivaSlotBooking.Status.BOOKED:
            return Response(
                {"detail": "Only booked slots can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if booking.slot_start <= timezone.now():
            return Response(
                {"detail": "Cannot cancel a slot that has already started."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = VivaSlotBooking.Status.CANCELLED
        booking.save(update_fields=["status", "updated_at"])
        return Response(VivaSlotBookingSerializer(booking).data)

    @action(detail=False, methods=["get"], url_path="my")
    def my_bookings(self, request):
        """Return the student's active bookings."""
        bookings = VivaSlotBooking.objects.filter(
            student=request.user,
            status__in=[VivaSlotBooking.Status.BOOKED, VivaSlotBooking.Status.STARTED],
            is_deleted=False,
        ).select_related("assignment", "student", "viva_session")
        return Response(VivaSlotBookingSerializer(bookings, many=True).data)

    @action(detail=False, methods=["get"], url_path="for-assignment")
    def for_assignment(self, request):
        """Instructors: list all slot bookings for an assignment in this organization."""
        assignment_id = request.query_params.get("assignment")
        if not assignment_id:
            return Response({"detail": "assignment query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        org_id = self.get_organization_id()
        try:
            assignment = Assignment.objects.get(pk=assignment_id, course__organization_id=org_id)
        except Assignment.DoesNotExist:
            return Response({"detail": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)

        bookings = (
            VivaSlotBooking.objects.filter(assignment=assignment, is_deleted=False)
            .select_related("student", "assignment", "viva_session")
            .order_by("slot_start", "student__email")
        )
        return Response(VivaSlotBookingSerializer(bookings, many=True).data)
