from django.test import TestCase, override_settings

from accounts.models import User
from assignments.models import Assignment
from courses.models import Course
from orgs.models import Membership, Organization
from questions.planner import plan_questions
from rubrics.models import Rubric, RubricCriterion
from submissions.models import Submission
from viva.models import VivaSession
from viva.orchestrator import VivaOrchestrator


@override_settings(AI_PROVIDER="mock")
class EndToEndVivaFlowTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Test U", slug="test-u")
        self.instructor = User.objects.create_user(email="t@example.com", password="x")
        self.student = User.objects.create_user(email="s@example.com", password="x")
        Membership.objects.create(organization=self.org, user=self.instructor, role="instructor")
        Membership.objects.create(organization=self.org, user=self.student, role="student")
        self.course = Course.objects.create(
            organization=self.org, code="T101", title="Test", created_by=self.instructor
        )
        self.assignment = Assignment.objects.create(
            course=self.course, title="A1", status=Assignment.Status.PUBLISHED, created_by=self.instructor
        )
        rubric = Rubric.objects.create(assignment=self.assignment, title="R")
        RubricCriterion.objects.create(rubric=rubric, name="Methodology", category="methodology", order=0)
        self.submission = Submission.objects.create(
            assignment=self.assignment,
            student=self.student,
            status=Submission.Status.READY,
            knowledge_representation={"problem": "demo"},
        )

    def test_prepare_start_answer_complete(self):
        session = VivaSession.objects.create(
            assignment=self.assignment,
            submission=self.submission,
            student=self.student,
            question_budget=2,
        )
        orch = VivaOrchestrator(session, self.org)
        orch.prepare()
        session.refresh_from_db()
        self.assertEqual(session.state, VivaSession.State.READY)
        self.assertTrue(session.question_plans.exists())

        orch.start()
        session.refresh_from_db()
        self.assertEqual(session.state, VivaSession.State.IN_PROGRESS)
        q1 = session.questions.order_by("sequence").first()
        self.assertIsNotNone(q1)
        self.assertTrue((q1.provenance or {}).get("excerpt"))

        result = orch.submit_answer(q1.id, "We chose this approach because validation metrics improved.")
        self.assertIn("answer_id", result)
        self.assertIsNone(result.get("evaluation"))
        session.refresh_from_db()
        self.assertIn(
            session.state,
            [VivaSession.State.IN_PROGRESS, VivaSession.State.COMPLETED, VivaSession.State.REVIEW_REQUIRED],
        )
        self.assertTrue(session.coverage_state.get("asked"))
        if result.get("next_question_excerpt"):
            self.assertTrue(result["next_question_excerpt"].get("quote"))

        if session.state == VivaSession.State.IN_PROGRESS:
            q2 = session.questions.order_by("sequence").last()
            orch.submit_answer(q2.id, "The results support the claim with a higher F1 score.")
            session.refresh_from_db()
            self.assertEqual(session.state, VivaSession.State.COMPLETED)

    def test_plan_questions_creates_items(self):
        plan = plan_questions(self.submission, self.org, budget=4)
        self.assertGreaterEqual(plan.questions.count(), 1)
