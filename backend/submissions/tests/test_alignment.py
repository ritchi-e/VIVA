from django.test import TestCase, override_settings

from accounts.models import User
from assignments.models import Assignment
from courses.models import Course
from orgs.models import Membership, Organization
from submissions.alignment import assess_assignment_alignment
from submissions.models import Submission, SubmissionFile


@override_settings(AI_PROVIDER="mock")
class AssignmentAlignmentTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Align U", slug="align-u")
        self.instructor = User.objects.create_user(email="inst-align@example.com", password="x")
        self.student = User.objects.create_user(email="stu-align@example.com", password="x")
        Membership.objects.create(organization=self.org, user=self.instructor, role="instructor")
        Membership.objects.create(organization=self.org, user=self.student, role="student")
        self.course = Course.objects.create(
            organization=self.org, code="A100", title="Align", created_by=self.instructor
        )

    def _submission(self, title: str, description: str, filename: str, text: str) -> Submission:
        assignment = Assignment.objects.create(
            course=self.course,
            title=title,
            description=description,
            status=Assignment.Status.PUBLISHED,
            created_by=self.instructor,
        )
        submission = Submission.objects.create(
            assignment=assignment,
            student=self.student,
            status=Submission.Status.READY,
        )
        file = SubmissionFile.objects.create(
            submission=submission,
            original_filename=filename,
            file_type=SubmissionFile.FileType.PDF,
            extracted_text=text,
        )
        assess_assignment_alignment(submission, [(file, text, {})])
        submission.save(
            update_fields=["assignment_mismatch", "assignment_mismatch_reason", "assignment_alignment_score"]
        )
        return submission

    def test_unrelated_software_report_is_flagged(self):
        submission = self._submission(
            title="Machine Learning Project",
            description="Train a neural classifier on an image dataset.",
            filename="sde-report.pdf",
            text="This SDE project implements a Django REST API and React frontend for a ticketing microservice.",
        )
        self.assertTrue(submission.assignment_mismatch)
        self.assertLessEqual(submission.assignment_alignment_score, 0.10)
        self.assertTrue(submission.assignment_mismatch_reason)

    def test_related_submission_is_not_flagged(self):
        submission = self._submission(
            title="Machine Learning Project",
            description="Train a neural classifier on an image dataset.",
            filename="ml-report.pdf",
            text="We trained a CNN image classifier on a labelled dataset and report model accuracy.",
        )
        self.assertFalse(submission.assignment_mismatch)
        self.assertGreater(submission.assignment_alignment_score, 0.10)
