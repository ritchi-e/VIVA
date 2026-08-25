from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from assignments.models import Assignment
from courses.models import Course
from orgs.models import Membership, Organization
from submissions.models import Submission
from viva.models import VivaSlotBooking


def _auth(client, user, org):
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_ORGANIZATION_ID=str(org.id))
    return client


def test_instructor_lists_assignment_slot_bookings(db):
    org = Organization.objects.create(name="Slot Org", slug="slot-org")
    instructor = User.objects.create_user(email="inst@slot.edu", password="x", full_name="Inst")
    student = User.objects.create_user(email="stu@slot.edu", password="x", full_name="Alex Student")
    Membership.objects.create(organization=org, user=instructor, role=Membership.Role.INSTRUCTOR)
    Membership.objects.create(organization=org, user=student, role=Membership.Role.STUDENT)
    course = Course.objects.create(organization=org, code="S101", title="Slots", created_by=instructor)
    assignment = Assignment.objects.create(
        course=course, title="Viva A", status=Assignment.Status.PUBLISHED, created_by=instructor
    )
    submission = Submission.objects.create(
        assignment=assignment, student=student, status=Submission.Status.READY
    )
    start = timezone.now().replace(second=0, microsecond=0) + timedelta(hours=1)
    VivaSlotBooking.objects.create(
        student=student,
        assignment=assignment,
        submission=submission,
        slot_start=start,
        slot_end=start + timedelta(minutes=10),
    )

    client = _auth(APIClient(), instructor, org)
    resp = client.get(f"/api/viva/slots/for-assignment/?assignment={assignment.id}")
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert resp.data[0]["student_email"] == "stu@slot.edu"
    assert resp.data[0]["status"] == "booked"


def test_student_cannot_list_assignment_slot_bookings(db):
    org = Organization.objects.create(name="Slot Org 2", slug="slot-org-2")
    instructor = User.objects.create_user(email="inst2@slot.edu", password="x")
    student = User.objects.create_user(email="stu2@slot.edu", password="x")
    Membership.objects.create(organization=org, user=instructor, role=Membership.Role.INSTRUCTOR)
    Membership.objects.create(organization=org, user=student, role=Membership.Role.STUDENT)
    course = Course.objects.create(organization=org, code="S102", title="Slots", created_by=instructor)
    assignment = Assignment.objects.create(
        course=course, title="Viva B", status=Assignment.Status.PUBLISHED, created_by=instructor
    )

    client = _auth(APIClient(), student, org)
    resp = client.get(f"/api/viva/slots/for-assignment/?assignment={assignment.id}")
    assert resp.status_code == 403
