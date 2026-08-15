from io import BytesIO
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from assignments.models import Assignment
from courses.models import Course
from orgs.models import Membership, Organization
from submissions.models import Submission
from viva.models import VivaIntegrityEvent, VivaSession
from viva.orchestrator import VivaOrchestrator


@override_settings(AI_PROVIDER="mock")
class IntegrityProctorApiTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Proc U", slug="proc-u")
        self.instructor = User.objects.create_user(email="inst@proc.edu", password="x")
        self.student = User.objects.create_user(email="stu@proc.edu", password="x", full_name="Stu Dent")
        Membership.objects.create(organization=self.org, user=self.instructor, role=Membership.Role.INSTRUCTOR)
        Membership.objects.create(organization=self.org, user=self.student, role=Membership.Role.STUDENT)
        self.course = Course.objects.create(
            organization=self.org, code="P101", title="Proc", created_by=self.instructor
        )
        self.assignment = Assignment.objects.create(
            course=self.course, title="Viva A", status=Assignment.Status.PUBLISHED, created_by=self.instructor
        )
        self.submission = Submission.objects.create(
            assignment=self.assignment, student=self.student, status=Submission.Status.READY
        )
        self.session = VivaSession.objects.create(
            assignment=self.assignment,
            submission=self.submission,
            student=self.student,
            state=VivaSession.State.IN_PROGRESS,
            question_budget=4,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.student)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.id))

    def test_tab_hidden_does_not_terminate(self):
        response = self.client.post(
            f"/api/viva/sessions/{self.session.id}/integrity/",
            {"event_type": "tab_hidden"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.session.refresh_from_db()
        self.assertEqual(self.session.state, VivaSession.State.IN_PROGRESS)
        self.assertEqual(self.session.integrity_events.filter(event_type="tab_hidden").count(), 1)

    def test_grace_expired_fails_session_without_complete(self):
        with patch("viva.orchestrator.VivaOrchestrator._enqueue_integrity_notice") as notice:
            response = self.client.post(
                f"/api/viva/sessions/{self.session.id}/integrity/",
                {"event_type": "grace_expired", "metadata": {"hidden_ms": 5100}},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.session.refresh_from_db()
        self.assertEqual(self.session.state, VivaSession.State.FAILED)
        self.assertIn("left the exam window", self.session.error_message)
        self.assertTrue((self.session.config or {}).get("integrity_termination"))
        notice.assert_called()

    def test_orchestrator_terminate_skips_evaluation_queue(self):
        orch = VivaOrchestrator(self.session, self.org)
        with patch.object(orch, "_enqueue_post_process") as post:
            with patch.object(orch, "_enqueue_integrity_notice"):
                orch.terminate_integrity(reason="grace_expired")
        post.assert_not_called()
        self.session.refresh_from_db()
        self.assertEqual(self.session.state, VivaSession.State.FAILED)

    @patch("common.storage.upload_fileobj", return_value="proctor/x.jpg")
    def test_proctor_frame_upload(self, _upload):
        jpeg = BytesIO(b"\xff\xd8\xff" + b"0" * 200)
        jpeg.name = "snap.jpg"
        response = self.client.post(
            f"/api/viva/sessions/{self.session.id}/proctor-frames/",
            {"frame": jpeg},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        self.session.refresh_from_db()
        self.assertEqual(self.session.proctor_frames.count(), 1)
        self.assertTrue(
            VivaIntegrityEvent.objects.filter(
                session=self.session, event_type=VivaIntegrityEvent.EventType.FRAME_UPLOADED
            ).exists()
        )
