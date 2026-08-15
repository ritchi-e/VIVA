from django.test import TestCase

from accounts.models import User
from assignments.models import Assignment, LearningOutcome
from courses.models import Course
from orgs.models import Membership, Organization
from questions.planner import plan_questions, word_planned_question
from rag.context import retrieve_for_submission
from rubrics.models import Rubric, RubricCriterion
from submissions.models import Submission, SubmissionChunk, SubmissionFile


class RagQuestionPlannerTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="RAG U", slug="rag-u")
        self.instructor = User.objects.create_user(email="inst@example.com", password="x")
        self.student = User.objects.create_user(email="stu@example.com", password="x")
        Membership.objects.create(organization=self.org, user=self.instructor, role="instructor")
        Membership.objects.create(organization=self.org, user=self.student, role="student")
        self.course = Course.objects.create(
            organization=self.org, code="R101", title="RAG Course", created_by=self.instructor
        )
        self.assignment = Assignment.objects.create(
            course=self.course,
            title="Neural Networks Report",
            instructions="Explain your model architecture and training choices.",
            status=Assignment.Status.PUBLISHED,
            created_by=self.instructor,
        )
        LearningOutcome.objects.create(
            assignment=self.assignment, code="LO1", description="Explain model design", order=0
        )
        rubric = Rubric.objects.create(assignment=self.assignment, title="Rubric")
        RubricCriterion.objects.create(
            rubric=rubric, name="Methodology", category="methodology", order=0
        )
        self.submission = Submission.objects.create(
            assignment=self.assignment,
            student=self.student,
            status=Submission.Status.READY,
            knowledge_representation={
                "problem": "Classify images with a convolutional neural network.",
                "methodology": {"methods": ["CNN", "data augmentation"]},
            },
        )
        sf = SubmissionFile.objects.create(
            submission=self.submission,
            original_filename="report.txt",
            content_type="text/plain",
            file_type="other",
            size_bytes=500,
            storage_key="demo/report.txt",
            extracted_text=(
                "## Problem\nWe classify CIFAR-10 images.\n\n"
                "## Methodology\nWe used a ResNet-18 with batch normalization and Adam optimizer.\n\n"
                "## Results\nTest accuracy reached 91.2% after 40 epochs."
            ),
        )
        chunks = [
            "We classify CIFAR-10 images using supervised learning.",
            "We used a ResNet-18 with batch normalization and Adam optimizer.",
            "Test accuracy reached 91.2% after 40 epochs with early stopping.",
        ]
        from ai.service import AIService

        vectors = AIService(organization=self.org).embed(chunks).vectors
        for index, (content, vector) in enumerate(zip(chunks, vectors)):
            SubmissionChunk.objects.create(
                submission=self.submission,
                file=sf,
                chunk_index=index,
                content=content,
                token_count=len(content.split()),
                embedding=vector,
                source_ref="report.txt",
            )

    def test_retrieve_for_submission_returns_relevant_chunks(self):
        results = retrieve_for_submission(
            self.submission,
            self.org,
            "ResNet architecture and optimizer",
            top_k=2,
        )
        self.assertGreaterEqual(len(results), 1)
        combined = " ".join(item["content"] for item in results)
        self.assertIn("ResNet", combined)

    def test_plan_questions_grounded_in_submission(self):
        plan = plan_questions(self.submission, self.org, budget=3)
        questions = list(plan.questions.order_by("order"))
        self.assertEqual(len(questions), 3)
        for planned in questions:
            self.assertTrue(planned.concept)
            self.assertNotRegex(planned.concept, r"Concept \d+")
            self.assertTrue(planned.metadata.get("rag_chunks"))
            self.assertIn("quality", planned.metadata)
            self.assertIn("grounded", planned.metadata["quality"])
            word_planned_question(planned, self.org)
            self.assertTrue(planned.wording)
            self.assertNotIn("Concept 1", planned.wording)
