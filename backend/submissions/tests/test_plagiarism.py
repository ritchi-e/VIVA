import hashlib

from django.test import TestCase

from accounts.models import User
from assignments.models import Assignment
from courses.models import Course
from orgs.models import Membership, Organization
from submissions.models import PlagiarismReport, Submission, SubmissionChunk, SubmissionFile
from submissions.plagiarism import generate_plagiarism_report


class PlagiarismDetectionTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Plag U", slug="plag-u")
        self.instructor = User.objects.create_user(email="inst-plag@example.com", password="x")
        self.student_a = User.objects.create_user(email="stu-a@example.com", password="x", full_name="Student A")
        self.student_b = User.objects.create_user(email="stu-b@example.com", password="x", full_name="Student B")
        Membership.objects.create(organization=self.org, user=self.instructor, role="instructor")
        Membership.objects.create(organization=self.org, user=self.student_a, role="student")
        Membership.objects.create(organization=self.org, user=self.student_b, role="student")
        self.course = Course.objects.create(
            organization=self.org, code="P101", title="Plagiarism Course", created_by=self.instructor
        )
        self.assignment = Assignment.objects.create(
            course=self.course,
            title="Project",
            status=Assignment.Status.PUBLISHED,
            created_by=self.instructor,
        )
        self.submission_a = Submission.objects.create(
            assignment=self.assignment,
            student=self.student_a,
            status=Submission.Status.READY,
            version=1,
        )
        self.submission_b = Submission.objects.create(
            assignment=self.assignment,
            student=self.student_b,
            status=Submission.Status.READY,
            version=1,
        )

    def _add_shared_upload(self, submission: Submission, content: bytes, filename: str = "report.pdf") -> None:
        checksum = hashlib.sha256(content).hexdigest()
        SubmissionFile.objects.create(
            submission=submission,
            original_filename=filename,
            content_type="application/pdf",
            file_type=SubmissionFile.FileType.PDF,
            size_bytes=len(content),
            storage_key=f"test/{submission.id}/{filename}",
            checksum=checksum,
        )

    def _embedding_for(self, content: str) -> list[float]:
        raw = hashlib.sha256(content.encode("utf-8")).digest()
        return [round(b / 255.0, 4) for b in raw[:8]]

    def _add_chunk(self, submission: Submission, content: str, index: int) -> None:
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
        SubmissionChunk.objects.create(
            submission=submission,
            chunk_index=index,
            content=content,
            token_count=len(content.split()),
            content_hash=digest,
            path=f"src/module{index}.py",
            embedding=self._embedding_for(content),
        )

    def test_identical_uploads_are_flagged(self):
        payload = b"shared project report body"
        self._add_shared_upload(self.submission_a, payload)
        self._add_shared_upload(self.submission_b, payload)

        report = generate_plagiarism_report(self.submission_a)

        self.assertEqual(report.status, PlagiarismReport.Status.COMPLETE)
        self.assertTrue(report.plagiarism_detected)
        self.assertEqual(len(report.matches), 1)
        self.assertEqual(report.matches[0]["student_email"], self.student_b.email)
        self.assertEqual(report.matches[0]["matching_upload_files"], 1)

    def test_shared_chunk_hashes_are_flagged(self):
        shared = "def train_model():\n    return fit(X, y)\n"
        for idx in range(4):
            self._add_chunk(self.submission_a, shared + str(idx), idx)
            self._add_chunk(self.submission_b, shared + str(idx), idx)

        report = generate_plagiarism_report(self.submission_a)

        self.assertTrue(report.plagiarism_detected)
        self.assertGreater(report.highest_similarity, 0.4)
        self.assertGreaterEqual(report.matches[0]["matching_chunks"], 4)

    def test_no_peers_skips_report(self):
        self.submission_b.delete()
        report = generate_plagiarism_report(self.submission_a)
        self.assertEqual(report.status, PlagiarismReport.Status.SKIPPED)
        self.assertFalse(report.plagiarism_detected)

    def test_unrelated_submissions_not_flagged(self):
        self._add_chunk(self.submission_a, "alpha beta gamma", 0)
        self._add_chunk(self.submission_b, "completely different source code", 0)

        report = generate_plagiarism_report(self.submission_a)

        self.assertEqual(report.status, PlagiarismReport.Status.COMPLETE)
        self.assertFalse(report.plagiarism_detected)
