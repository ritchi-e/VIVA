from django.test import TestCase

from accounts.models import User
from assignments.models import Assignment
from courses.models import Course
from orgs.models import Membership, Organization
from rag.context import retrieve_for_submission
from submissions.models import Submission, SubmissionChunk


class HybridRetrievalTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Ret U", slug="ret-u")
        instructor = User.objects.create_user(email="inst-ret@example.com", password="x")
        self.student = User.objects.create_user(email="stu-ret@example.com", password="x")
        Membership.objects.create(organization=self.org, user=instructor, role="instructor")
        Membership.objects.create(organization=self.org, user=self.student, role="student")
        course = Course.objects.create(organization=self.org, code="R301", title="Ret", created_by=instructor)
        assignment = Assignment.objects.create(
            course=course, title="Ret", status=Assignment.Status.PUBLISHED, created_by=instructor
        )
        self.submission = Submission.objects.create(
            assignment=assignment, student=self.student, status=Submission.Status.READY
        )
        from ai.service import AIService

        contents = [
            ("src/model.py:1-20", "def train_model():\n    clf = RandomForestClassifier()\n", "train_model", "src/model.py"),
            ("README.md:1-8", "This project classifies images with a CNN.", "", "README.md"),
        ]
        vectors = AIService(organization=self.org).embed([c[1] for c in contents]).vectors
        for index, ((ref, content, symbol, path), vector) in enumerate(zip(contents, vectors)):
            SubmissionChunk.objects.create(
                submission=self.submission,
                chunk_index=index,
                content=content,
                token_count=len(content.split()),
                embedding=vector,
                source_ref=ref,
                path=path,
                symbol=symbol,
            )

    def test_symbol_query_prefers_matching_file(self):
        results = retrieve_for_submission(
            self.submission,
            self.org,
            "train_model RandomForestClassifier in src/model.py",
            top_k=2,
        )
        self.assertTrue(results)
        self.assertTrue(any("model.py" in (item.get("source_ref") or "") for item in results))
