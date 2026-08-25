from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from assignments.models import Assignment
from courses.models import Course
from orgs.models import Membership, Organization
from submissions.models import Submission, SubmissionFile


class SubmissionFileContentTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="File U", slug="file-u")
        self.instructor = User.objects.create_user(email="inst-file@example.com", password="x")
        self.student = User.objects.create_user(email="stu-file@example.com", password="x")
        Membership.objects.create(organization=self.org, user=self.instructor, role="instructor")
        Membership.objects.create(organization=self.org, user=self.student, role="student")
        self.course = Course.objects.create(
            organization=self.org, code="F100", title="Files", created_by=self.instructor
        )
        self.assignment = Assignment.objects.create(
            course=self.course,
            title="Report",
            status=Assignment.Status.PUBLISHED,
            created_by=self.instructor,
        )
        self.submission = Submission.objects.create(
            assignment=self.assignment,
            student=self.student,
            status=Submission.Status.READY,
        )
        self.uploaded = SubmissionFile.objects.create(
            submission=self.submission,
            original_filename="report.pdf",
            content_type="application/pdf",
            file_type=SubmissionFile.FileType.PDF,
            storage_key="orgs/file-u/report.pdf",
            size_bytes=12,
        )
        self.client = APIClient()

    def test_instructor_can_download_inline_pdf(self):
        self.client.force_authenticate(user=self.instructor)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.id))
        with patch("submissions.views.download_bytes", return_value=b"%PDF-fake"):
            resp = self.client.get(
                f"/api/submissions/{self.submission.id}/files/{self.uploaded.id}/content/"
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        self.assertIn("inline", resp["Content-Disposition"])
