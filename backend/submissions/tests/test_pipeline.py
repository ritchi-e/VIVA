import io
import zipfile
from unittest.mock import patch

from django.test import TestCase, override_settings

from accounts.models import User
from assignments.models import Assignment
from courses.models import Course
from orgs.models import Membership, Organization
from submissions.models import RepositorySnapshot, Submission, SubmissionChunk
from submissions.pipeline import run_submission_pipeline
from submissions.repository.fetch import GithubSnapshotMeta
from submissions.repository.urls import parse_github_url


def _zip_bytes(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        for path, content in files.items():
            zf.writestr(path, content)
    return buffer.getvalue()


class GithubIngestionPipelineTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Repo U", slug="repo-u")
        self.instructor = User.objects.create_user(email="inst-repo@example.com", password="x")
        self.student = User.objects.create_user(email="stu-repo@example.com", password="x")
        Membership.objects.create(organization=self.org, user=self.instructor, role="instructor")
        Membership.objects.create(organization=self.org, user=self.student, role="student")
        self.course = Course.objects.create(
            organization=self.org, code="R201", title="Repo Course", created_by=self.instructor
        )
        self.assignment = Assignment.objects.create(
            course=self.course,
            title="Final project",
            status=Assignment.Status.PUBLISHED,
            created_by=self.instructor,
            allow_github=True,
        )
        self.submission = Submission.objects.create(
            assignment=self.assignment,
            student=self.student,
            github_url="https://github.com/student/demo",
            status=Submission.Status.QUEUED,
        )

    @override_settings(GITHUB_STATIC_INGESTION_ENABLED=True, AI_PROVIDER="mock")
    def test_pipeline_indexes_repo_and_creates_semantic_chunks(self):
        archive = _zip_bytes(
            {
                "demo-abc/README.md": "# Image classifier\nCNN project",
                "demo-abc/src/model.py": (
                    "from src import preprocess\n\n"
                    "def train_model(data):\n"
                    "    return preprocess.normalize(data)\n"
                ),
                "demo-abc/src/preprocess.py": "def normalize(data):\n    return data\n",
                "demo-abc/node_modules/leftpad/index.js": "module.exports=1",
            }
        )
        meta = GithubSnapshotMeta(
            owner="student",
            repo="demo",
            default_branch="main",
            commit_sha="abc123def456",
            archive_bytes=archive,
            html_url="https://github.com/student/demo",
        )

        def fake_persist(_org, _sid, sha, _archive):
            return f"orgs/x/submissions/y/github-{sha}.zip"

        with (
            patch("submissions.repository.ingest.resolve_and_download", return_value=meta),
            patch("submissions.repository.ingest.persist_archive", side_effect=fake_persist),
        ):
            run_submission_pipeline(str(self.submission.id))

        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, Submission.Status.READY)
        self.assertEqual(self.submission.processing_stage, Submission.ProcessingStage.COMPLETE)
        snapshot = RepositorySnapshot.objects.get(submission=self.submission)
        self.assertEqual(snapshot.commit_sha, "abc123def456")
        self.assertGreaterEqual(snapshot.files_indexed, 3)
        self.assertGreaterEqual(snapshot.files_skipped, 1)
        chunks = list(SubmissionChunk.objects.filter(submission=self.submission))
        self.assertTrue(chunks)
        self.assertTrue(any("train_model" in (c.symbol or "") or "train_model" in c.content for c in chunks))
        self.assertTrue(any(c.source_ref.startswith("src/") for c in chunks))
        self.assertIn("repository", self.submission.metadata)
        self.assertTrue(self.submission.question_candidates.exists())

    def test_parse_github_url_used_for_canonical_form(self):
        parsed = parse_github_url(self.submission.github_url)
        self.assertEqual(parsed.canonical_url, "https://github.com/student/demo")
