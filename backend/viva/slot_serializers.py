from __future__ import annotations

from rest_framework import serializers

from viva.models import VivaSlotBooking


class SlotWindowSerializer(serializers.Serializer):
    slot_start = serializers.DateTimeField()
    slot_end = serializers.DateTimeField()
    capacity = serializers.IntegerField()
    booked = serializers.IntegerField()
    available = serializers.IntegerField()


class VivaSlotBookingSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)
    viva_session_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = VivaSlotBooking
        fields = [
            "id",
            "student",
            "student_name",
            "assignment",
            "assignment_title",
            "submission",
            "slot_start",
            "slot_end",
            "status",
            "viva_session_id",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "student",
            "student_name",
            "assignment_title",
            "slot_end",
            "status",
            "viva_session_id",
            "created_at",
        ]


class BookSlotSerializer(serializers.Serializer):
    assignment_id = serializers.UUIDField()
    slot_start = serializers.DateTimeField()
