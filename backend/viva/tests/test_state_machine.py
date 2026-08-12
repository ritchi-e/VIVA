import pytest

from orgs.models import Organization
from submissions.models import Submission
from viva.models import VivaSession
from viva.orchestrator import ALLOWED_TRANSITIONS, VivaOrchestrator


@pytest.mark.django_db
def test_viva_state_transitions(org_user, student_user):
    from accounts.models import User
    from assignments.models import Assignment
    from courses.models import Course, CourseEnrollment
    from orgs.models import Membership

    instructor, org = org_user
    student, _ = student_user
    course = Course.objects.create(organization=org, code="VIVA101", title="Viva", created_by=instructor)
    CourseEnrollment.objects.create(course=course, user=student, role=CourseEnrollment.Role.STUDENT)
    assignment = Assignment.objects.create(course=course, title="A1", created_by=instructor)
    submission = Submission.objects.create(
        assignment=assignment,
        student=student,
        status=Submission.Status.READY,
    )
    session = VivaSession.objects.create(
        assignment=assignment,
        submission=submission,
        student=student,
        state=VivaSession.State.CREATED,
    )
    orchestrator = VivaOrchestrator(session, org)
    orchestrator.prepare()
    session.refresh_from_db()
    assert session.state in (VivaSession.State.READY, VivaSession.State.FAILED)
    assert VivaSession.State.PREPARING in ALLOWED_TRANSITIONS[VivaSession.State.CREATED]
