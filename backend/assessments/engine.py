from __future__ import annotations

from django.utils import timezone

from ai.service import AIService
from assessments.models import Assessment, AssessmentCriterion, AssessmentModification
from orgs.models import Organization
from rubrics.models import Rubric, RubricCriterion
from viva.models import AnswerEvaluation, VivaSession

ASSESSMENT_SCHEMA = {
    "title": "assessment_generation",
    "type": "object",
    "properties": {
        "overall_score": {"type": "number"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "weaknesses": {"type": "array", "items": {"type": "string"}},
        "evidence_summary": {"type": "string"},
        "areas_requiring_review": {"type": "array", "items": {"type": "string"}},
        "unanswered_areas": {"type": "array", "items": {"type": "string"}},
        "recommended_followups": {"type": "array", "items": {"type": "string"}},
        "criteria": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "ai_score": {"type": "number"},
                    "explanation": {"type": "string"},
                },
            },
        },
    },
}


def generate_assessment_for_session(session: VivaSession, organization: Organization) -> Assessment:
    evaluations = AnswerEvaluation.objects.filter(
        answer__attempt__question__session=session,
    ).select_related("answer__attempt__question")
    summary_lines = []
    for ev in evaluations:
        q = ev.answer.attempt.question
        summary_lines.append(
            f"Q{q.sequence}: {q.question_text}\n"
            f"Answer: {ev.answer.text}\n"
            f"Scores: overall={ev.overall}, accuracy={ev.conceptual_accuracy}, "
            f"evidence={ev.evidence_support}, depth={ev.depth}, relevance={ev.relevance}\n"
            f"Evaluation: {ev.explanation}"
        )
    if not summary_lines:
        # Fallback if evaluations are missing: use raw Q&A.
        for question in session.questions.prefetch_related("attempts__answers").order_by("sequence"):
            attempt = question.attempts.order_by("-attempt_number").first()
            answer = attempt.answers.order_by("-submitted_at").first() if attempt else None
            summary_lines.append(
                f"Q{question.sequence}: {question.question_text}\n"
                f"Answer: {(answer.text if answer else '[no answer]')}"
            )
    ai = AIService(organization=organization, user=session.student)
    result = ai.structured(
        [
            {"role": "system", "content": (
                "Generate a draft assessment for instructor review based on viva Q&A evaluations. "
                "Be evidence-based, cite what the student demonstrated or failed to demonstrate, "
                "and do not invent details not supported by the viva summary. "
                "Return ONLY valid JSON matching the schema."
            )},
            {"role": "user", "content": "\n\n".join(summary_lines) or "No answers recorded."},
        ],
        ASSESSMENT_SCHEMA,
    )
    data = result.data
    assessment, _ = Assessment.objects.update_or_create(
        viva_session=session,
        defaults={
            "submission": session.submission,
            "status": Assessment.Status.PENDING_REVIEW,
            "ai_overall_score": float(data.get("overall_score", 0)),
            "overall_score": float(data.get("overall_score", 0)),
            "strengths": data.get("strengths", []),
            "weaknesses": data.get("weaknesses", []),
            "evidence_summary": data.get("evidence_summary", ""),
            "areas_requiring_review": data.get("areas_requiring_review", []),
            "unanswered_areas": data.get("unanswered_areas", []),
            "recommended_followups": data.get("recommended_followups", []),
            "disclaimer": (
                "AI-generated assessment of the student's understanding of the submitted implementation. "
                "This does not verify that the code executes. Instructor review required."
            )[:255],
        },
    )
    assessment.criteria.all().delete()
    rubric = Rubric.objects.filter(assignment=session.assignment).first()
    rubric_criteria = list(RubricCriterion.objects.filter(rubric=rubric)) if rubric else []
    rubric_map = {c.name: c for c in rubric_criteria}
    criteria_payload = data.get("criteria") or []
    if not criteria_payload and rubric_criteria:
        avg = float(data.get("overall_score", 7)) / 10.0 * 10
        criteria_payload = [
            {"name": c.name, "ai_score": avg, "explanation": f"AI draft for {c.name}"}
            for c in rubric_criteria
        ]
    for crit in criteria_payload:
        name = crit.get("name", "Criterion")
        rc = rubric_map.get(name)
        AssessmentCriterion.objects.create(
            assessment=assessment,
            rubric_criterion=rc,
            name=name,
            category=rc.category if rc else "",
            ai_score=float(crit.get("ai_score", 0)),
            final_score=float(crit.get("ai_score", 0)),
            max_score=float(rc.max_score) if rc else 10,
            weight=float(rc.weight) if rc else 1,
            ai_explanation=crit.get("explanation", ""),
            explanation=crit.get("explanation", ""),
        )
    return assessment


def apply_assessment_modification(
    assessment: Assessment,
    reviewer,
    *,
    criterion_id=None,
    field_name: str,
    new_value,
    reason: str = "",
) -> AssessmentModification:
    criterion = None
    old_value = None
    if field_name == "overall_score":
        old_value = assessment.overall_score
        assessment.overall_score = float(new_value)
        assessment.status = Assessment.Status.MODIFIED
        assessment.reviewed_by = reviewer
        assessment.reviewed_at = timezone.now()
        assessment.save(update_fields=["overall_score", "status", "reviewed_by", "reviewed_at", "updated_at"])
    elif field_name == "instructor_score" and criterion_id:
        criterion = AssessmentCriterion.objects.get(pk=criterion_id, assessment=assessment)
        old_value = criterion.instructor_score
        criterion.instructor_score = float(new_value)
        criterion.final_score = float(new_value)
        criterion.save(update_fields=["instructor_score", "final_score", "updated_at"])
        assessment.status = Assessment.Status.MODIFIED
        assessment.reviewed_by = reviewer
        assessment.reviewed_at = timezone.now()
        assessment.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    elif field_name == "instructor_notes":
        old_value = assessment.instructor_notes
        assessment.instructor_notes = str(new_value)
        assessment.save(update_fields=["instructor_notes", "updated_at"])
    mod = AssessmentModification.objects.create(
        assessment=assessment,
        criterion=criterion,
        reviewer=reviewer,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
    )
    return mod


def finalize_assessment(assessment: Assessment, reviewer, instructor_notes: str | None = None) -> Assessment:
    if instructor_notes is not None:
        assessment.instructor_notes = instructor_notes
    assessment.status = Assessment.Status.FINALIZED
    assessment.reviewed_by = reviewer
    assessment.reviewed_at = timezone.now()
    assessment.finalized_at = timezone.now()
    assessment.save(
        update_fields=["status", "reviewed_by", "reviewed_at", "finalized_at", "instructor_notes", "updated_at"]
    )
    return assessment
