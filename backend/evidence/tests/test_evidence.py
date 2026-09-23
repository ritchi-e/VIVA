from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from assessments.engine import record_question_override
from assessments.models import Assessment, AssessmentModification
from assignments.models import Assignment
from courses.models import Course
from evidence.models import EvidenceFlag
from evidence.services import build_dashboard, build_question_detail, create_flag, derive_coverage
from orgs.models import Membership, Organization
from rubrics.models import Rubric, RubricCriterion
from submissions.models import Submission, SubmissionChunk
from viva.evaluation import _save_evaluation
from viva.models import AnswerEvaluation, QuestionAttempt, StudentAnswer, VivaQuestion, VivaSession


class EvidenceBase(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Evidence Org", slug="evidence-org")
        self.other_org = Organization.objects.create(name="Other Org", slug="other-org")
        self.instructor = User.objects.create_user(email="ev-inst@example.com", password="x")
        self.other_instructor = User.objects.create_user(email="ev-other@example.com", password="x")
        self.student = User.objects.create_user(email="ev-stu@example.com", password="x")
        Membership.objects.create(organization=self.org, user=self.instructor, role="instructor")
        Membership.objects.create(organization=self.other_org, user=self.other_instructor, role="instructor")
        Membership.objects.create(organization=self.org, user=self.student, role="student")
        self.course = Course.objects.create(
            organization=self.org, code="E101", title="Evidence", created_by=self.instructor
        )
        self.assignment = Assignment.objects.create(
            course=self.course,
            title="Evidence A1",
            status=Assignment.Status.PUBLISHED,
            created_by=self.instructor,
        )
        rubric = Rubric.objects.create(assignment=self.assignment, title="R")
        RubricCriterion.objects.create(rubric=rubric, name="Methodology", category="methodology", order=0)
        self.submission = Submission.objects.create(
            assignment=self.assignment,
            student=self.student,
            status=Submission.Status.READY,
        )
        self.chunk = SubmissionChunk.objects.create(
            submission=self.submission,
            chunk_index=0,
            content="We used cross-validation for model selection.",
            source_ref="report.pdf#page=2",
            path="report.pdf",
            page_number=2,
            content_hash="abc",
        )
        self.session = VivaSession.objects.create(
            assignment=self.assignment,
            submission=self.submission,
            student=self.student,
            state=VivaSession.State.COMPLETED,
            questions_asked=1,
            question_budget=1,
        )
        self.question = VivaQuestion.objects.create(
            session=self.session,
            sequence=1,
            question_text="Why did you choose cross-validation?",
            question_type="methodology",
            retrieval_query="cross validation methodology",
            prompt_version="viva_turn.v1",
            model_name="mock-model",
            model_provider="MockChat",
            source_chunk=self.chunk,
            provenance={
                "concept": "cross-validation",
                "purpose": "probe methodology",
                "rationale": "Anchored to report excerpt",
                "source_ref": "report.pdf#page=2",
                "excerpt": {
                    "quote": "We used cross-validation for model selection.",
                    "source_ref": "report.pdf#page=2",
                    "chunk_id": str(self.chunk.id),
                },
            },
        )
        attempt = QuestionAttempt.objects.create(question=self.question, attempt_number=1)
        self.answer = StudentAnswer.objects.create(
            attempt=attempt,
            text="It reduces overfitting risk on small datasets.",
            input_mode="text",
            metadata={"asr": {"provider": "mock"}},
        )
        self.evaluation = AnswerEvaluation.objects.create(
            answer=self.answer,
            conceptual_accuracy=8,
            evidence_support=7,
            depth=7,
            relevance=8,
            overall=7.5,
            explanation="Solid methodology answer",
            evidence_refs=[str(self.chunk.id)],
            confidence=AnswerEvaluation.Confidence.HIGH,
            evidence_quality=AnswerEvaluation.EvidenceQuality.DIRECT,
            is_current=True,
            version=1,
        )
        self.assessment = Assessment.objects.create(
            viva_session=self.session,
            submission=self.submission,
            status=Assessment.Status.PENDING_REVIEW,
            overall_score=7.5,
            ai_overall_score=7.5,
            evidence_summary="Student explained cross-validation well.",
        )
        self.client = APIClient()


class EvaluationSupersedeTests(EvidenceBase):
    def test_save_evaluation_supersedes_previous(self):
        updated = _save_evaluation(
            self.answer,
            {
                "conceptual_accuracy": 9,
                "evidence_support": 8,
                "depth": 8,
                "relevance": 9,
                "overall": 8.5,
                "requires_follow_up": False,
                "explanation": "Improved after regenerate",
                "evidence_refs": [str(self.chunk.id)],
                "confidence": "high",
                "evidence_quality": "direct",
            },
            submission_id=self.submission.id,
        )
        self.evaluation.refresh_from_db()
        self.assertFalse(self.evaluation.is_current)
        self.assertIsNotNone(self.evaluation.superseded_at)
        self.assertTrue(updated.is_current)
        self.assertEqual(updated.version, 2)
        self.assertEqual(self.answer.current_evaluation.id, updated.id)
        self.assertEqual(self.answer.evaluations.count(), 2)


class EvidenceServiceTests(EvidenceBase):
    def test_dashboard_and_question_detail(self):
        dashboard = build_dashboard(self.submission)
        self.assertEqual(dashboard["submission"]["id"], str(self.submission.id))
        self.assertEqual(dashboard["evidence_strength"], "strong")
        self.assertEqual(len(dashboard["questions"]), 1)

        detail = build_question_detail(self.question)
        self.assertEqual(detail["provenance_completeness"], "full")
        self.assertEqual(detail["topic"], "cross-validation")
        self.assertEqual(len(detail["supporting_evidence"]), 1)
        self.assertEqual(detail["supporting_evidence"][0]["location"]["page_number"], 2)

    def test_coverage_rows(self):
        rows = derive_coverage(self.submission)
        self.assertTrue(rows)
        self.assertIn(rows[0]["coverage"], {"strong", "moderate", "weak", "not_assessed"})


class EvidenceApiSecurityTests(EvidenceBase):
    def _auth(self, user, org):
        self.client.force_authenticate(user=user)
        return {"HTTP_X_ORGANIZATION_ID": str(org.id)}

    def test_dashboard_requires_same_org(self):
        headers = self._auth(self.instructor, self.org)
        ok = self.client.get(f"/api/evidence/submissions/{self.submission.id}/dashboard/", **headers)
        self.assertEqual(ok.status_code, 200)

        other_headers = self._auth(self.other_instructor, self.other_org)
        denied = self.client.get(
            f"/api/evidence/submissions/{self.submission.id}/dashboard/",
            **other_headers,
        )
        self.assertEqual(denied.status_code, 404)

    def test_question_detail_tenant_isolation(self):
        headers = self._auth(self.other_instructor, self.other_org)
        resp = self.client.get(f"/api/evidence/questions/{self.question.id}/detail/", **headers)
        self.assertEqual(resp.status_code, 404)

    def test_create_and_resolve_flag(self):
        headers = self._auth(self.instructor, self.org)
        create = self.client.post(
            "/api/evidence/flags/",
            {
                "viva_session": str(self.session.id),
                "viva_question": str(self.question.id),
                "flag_type": "requires_review",
                "description": "Needs human check",
            },
            format="json",
            **headers,
        )
        self.assertEqual(create.status_code, 201)
        flag_id = create.data["id"]

        resolve = self.client.post(
            f"/api/evidence/flags/{flag_id}/resolve/",
            {"status": "dismissed", "resolution_note": "False alarm"},
            format="json",
            **headers,
        )
        self.assertEqual(resolve.status_code, 200)
        self.assertEqual(resolve.data["status"], "dismissed")

    def test_question_review_endpoint(self):
        headers = self._auth(self.instructor, self.org)
        resp = self.client.post(
            f"/api/assessments/{self.assessment.id}/question-review/",
            {
                "viva_question_id": str(self.question.id),
                "action": "agree",
                "reason": "Looks good",
            },
            format="json",
            **headers,
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            AssessmentModification.objects.filter(
                assessment=self.assessment,
                viva_question=self.question,
                action=AssessmentModification.Action.AGREE,
            ).exists()
        )


@override_settings(AI_PROVIDER="mock")
class AssessmentEvidencePopulationTests(EvidenceBase):
    def test_record_question_override_sets_modified(self):
        mod = record_question_override(
            self.assessment,
            self.instructor,
            viva_question=self.question,
            action=AssessmentModification.Action.INSUFFICIENT_EVIDENCE,
            reason="Not enough support",
            answer_evaluation=self.evaluation,
        )
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, Assessment.Status.MODIFIED)
        self.assertEqual(mod.action, AssessmentModification.Action.INSUFFICIENT_EVIDENCE)


class ChunkLocationPropagationTests(TestCase):
    def test_file_chunks_preserve_page_and_slide(self):
        from submissions.pipeline import _file_chunks

        org = Organization.objects.create(name="Chunk Org", slug="chunk-org")
        instructor = User.objects.create_user(email="chunk-i@example.com", password="x")
        student = User.objects.create_user(email="chunk-s@example.com", password="x")
        Membership.objects.create(organization=org, user=instructor, role="instructor")
        Membership.objects.create(organization=org, user=student, role="student")
        course = Course.objects.create(organization=org, code="C1", title="C", created_by=instructor)
        assignment = Assignment.objects.create(
            course=course, title="A", status=Assignment.Status.PUBLISHED, created_by=instructor
        )
        submission = Submission.objects.create(
            assignment=assignment, student=student, status=Submission.Status.QUEUED
        )
        from submissions.models import SubmissionFile

        pdf = SubmissionFile.objects.create(
            submission=submission,
            original_filename="paper.pdf",
            file_type=SubmissionFile.FileType.PDF,
            storage_key="k1",
            extractor_version="pdf-v1",
        )
        chunks = _file_chunks(
            submission,
            [
                (
                    pdf,
                    "page one text\n\npage two text",
                    {
                        "pages": [
                            {"page": 1, "text": "page one text " * 40},
                            {"page": 2, "text": "page two text " * 40},
                        ]
                    },
                )
            ],
        )
        self.assertTrue(chunks)
        self.assertTrue(any(c.page_number == 1 for c in chunks))
        self.assertTrue(any(c.page_number == 2 for c in chunks))
        self.assertTrue(any("#page=" in (c.source_ref or "") for c in chunks))
