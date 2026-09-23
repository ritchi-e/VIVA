from __future__ import annotations

from collections import defaultdict

from django.utils import timezone

from assessments.models import Assessment, AssessmentEvidence
from evidence.models import EvidenceFlag
from submissions.models import Submission, SubmissionChunk
from viva.models import AnswerEvaluation, VivaQuestion, VivaSession


def _source_location(chunk: SubmissionChunk | None) -> dict:
    if not chunk:
        return {}
    return {
        "source_ref": chunk.source_ref or "",
        "path": chunk.path or "",
        "page_number": chunk.page_number,
        "section_heading": chunk.section_heading or "",
        "slide_number": chunk.slide_number,
        "inner_path": chunk.inner_path or "",
        "start_line": chunk.start_line,
        "end_line": chunk.end_line,
        "start_offset": chunk.start_offset,
        "end_offset": chunk.end_offset,
    }


def _current_eval(answer) -> AnswerEvaluation | None:
    if not answer:
        return None
    return answer.current_evaluation


def build_question_detail(question: VivaQuestion) -> dict:
    provenance = question.provenance or {}
    planned = question.planned_question
    attempt = question.attempts.order_by("-attempt_number").first()
    answer = attempt.answers.order_by("-submitted_at").first() if attempt else None
    evaluation = _current_eval(answer)
    excerpt = provenance.get("excerpt") if isinstance(provenance.get("excerpt"), dict) else {}

    supporting = []
    if evaluation and evaluation.evidence_refs:
        chunks = {
            str(c.id): c
            for c in SubmissionChunk.objects.filter(
                submission_id=question.session.submission_id,
                id__in=evaluation.evidence_refs,
            )
        }
        for ref in evaluation.evidence_refs:
            chunk = chunks.get(str(ref))
            if not chunk:
                continue
            supporting.append(
                {
                    "chunk_id": str(chunk.id),
                    "quote": (chunk.content or "")[:400],
                    "location": _source_location(chunk),
                }
            )

    assessment_evidence = []
    if answer:
        for item in AssessmentEvidence.objects.filter(answer=answer).select_related("criterion")[:20]:
            assessment_evidence.append(
                {
                    "id": str(item.id),
                    "criterion": item.criterion.name if item.criterion_id else "",
                    "source_ref": item.source_ref,
                    "quote": item.quote,
                    "note": item.note,
                }
            )

    flags = [
        {
            "id": str(flag.id),
            "flag_type": flag.flag_type,
            "severity": flag.severity,
            "description": flag.description,
            "status": flag.status,
            "confidence": flag.confidence,
        }
        for flag in EvidenceFlag.objects.filter(viva_question=question).order_by("-created_at")[:20]
    ]

    follow_ups = []
    if planned:
        for child in planned.follow_ups.all().order_by("order"):
            follow_ups.append(
                {
                    "id": str(child.id),
                    "order": child.order,
                    "wording": child.wording,
                    "concept": child.concept,
                    "is_follow_up": child.is_follow_up,
                }
            )

    has_rich = bool(
        question.retrieval_query
        or question.source_chunk_id
        or (planned and (planned.retrieval_query or planned.source_chunk_id))
        or excerpt.get("quote")
    )

    return {
        "question_id": str(question.id),
        "sequence": question.sequence,
        "question_text": question.question_text,
        "question_type": question.question_type,
        "purpose": provenance.get("purpose") or (planned.purpose if planned else "") or "",
        "topic": provenance.get("concept") or (planned.concept if planned else "") or "",
        "why_asked": {
            "rationale": provenance.get("rationale") or "",
            "retrieval_query": question.retrieval_query or (planned.retrieval_query if planned else "") or "",
            "source_ref": excerpt.get("source_ref") or provenance.get("source_ref") or "",
            "excerpt": excerpt.get("quote") or "",
            "source_location": _source_location(question.source_chunk),
        },
        "student_answer": (
            {
                "id": str(answer.id),
                "text": answer.text,
                "input_mode": answer.input_mode,
                "submitted_at": answer.submitted_at,
                "duration_seconds": answer.duration_seconds,
                "metadata": answer.metadata or {},
            }
            if answer
            else None
        ),
        "evaluation": (
            {
                "id": str(evaluation.id),
                "overall": evaluation.overall,
                "conceptual_accuracy": evaluation.conceptual_accuracy,
                "evidence_support": evaluation.evidence_support,
                "depth": evaluation.depth,
                "relevance": evaluation.relevance,
                "explanation": evaluation.explanation,
                "confidence": evaluation.confidence,
                "evidence_quality": evaluation.evidence_quality,
                "version": evaluation.version,
                "requires_follow_up": evaluation.requires_follow_up,
            }
            if evaluation
            else None
        ),
        "supporting_evidence": supporting,
        "assessment_evidence": assessment_evidence,
        "flags": flags,
        "follow_ups": follow_ups,
        "ai_provenance": {
            "model_name": question.model_name or (planned.model_name if planned else "") or "",
            "model_provider": question.model_provider or (planned.model_provider if planned else "") or "",
            "prompt_version": question.prompt_version or (planned.prompt_version if planned else "") or "",
        },
        "provenance_completeness": "full" if has_rich else "limited",
    }


def build_dashboard(submission: Submission) -> dict:
    session = (
        VivaSession.objects.filter(submission=submission)
        .exclude(state=VivaSession.State.FAILED)
        .order_by("-created_at")
        .first()
    )
    assessment = Assessment.objects.filter(submission=submission).order_by("-created_at").first()
    questions = []
    if session:
        for question in session.questions.prefetch_related("attempts__answers__evaluations").order_by("sequence"):
            attempt = question.attempts.order_by("-attempt_number").first()
            answer = attempt.answers.order_by("-submitted_at").first() if attempt else None
            evaluation = _current_eval(answer)
            provenance = question.provenance or {}
            questions.append(
                {
                    "question_id": str(question.id),
                    "sequence": question.sequence,
                    "question_text": question.question_text,
                    "topic": provenance.get("concept") or "",
                    "answered": bool(answer),
                    "evaluation_overall": evaluation.overall if evaluation else None,
                    "confidence": evaluation.confidence if evaluation else "",
                    "source_ref": (provenance.get("excerpt") or {}).get("source_ref")
                    or provenance.get("source_ref")
                    or "",
                    "flag_count": EvidenceFlag.objects.filter(viva_question=question, status=EvidenceFlag.Status.OPEN).count(),
                }
            )

    open_flags = EvidenceFlag.objects.filter(viva_session=session).count() if session else 0
    confidences = [q["confidence"] for q in questions if q.get("confidence")]
    if "insufficient_evidence" in confidences or "low" in confidences:
        evidence_strength = "weak"
    elif confidences and all(c == "high" for c in confidences):
        evidence_strength = "strong"
    elif confidences:
        evidence_strength = "moderate"
    else:
        evidence_strength = "unknown"

    return {
        "student": {
            "id": str(submission.student_id),
            "name": submission.student.full_name or submission.student.email,
            "email": submission.student.email,
        },
        "assignment": {
            "id": str(submission.assignment_id),
            "title": submission.assignment.title,
        },
        "submission": {
            "id": str(submission.id),
            "status": submission.status,
            "version": submission.version,
        },
        "viva_session": (
            {
                "id": str(session.id),
                "state": session.state,
                "questions_asked": session.questions_asked,
                "question_budget": session.question_budget,
            }
            if session
            else None
        ),
        "assessment": (
            {
                "id": str(assessment.id),
                "status": assessment.status,
                "overall_score": assessment.overall_score,
                "ai_overall_score": assessment.ai_overall_score,
                "evidence_summary": assessment.evidence_summary,
            }
            if assessment
            else None
        ),
        "questions": questions,
        "flags": {
            "total": open_flags,
            "open": EvidenceFlag.objects.filter(
                viva_session=session,
                status=EvidenceFlag.Status.OPEN,
            ).count()
            if session
            else 0,
        },
        "evidence_strength": evidence_strength,
        "topics_assessed": sorted({q["topic"] for q in questions if q.get("topic")}),
        "instructor_review_status": assessment.status if assessment else "not_started",
    }


def derive_coverage(submission: Submission) -> list[dict]:
    from rubrics.models import RubricCriterion

    criteria = list(
        RubricCriterion.objects.filter(rubric__assignment=submission.assignment).order_by("order")
    )
    session = (
        VivaSession.objects.filter(submission=submission)
        .exclude(state=VivaSession.State.FAILED)
        .order_by("-created_at")
        .first()
    )
    asked_by_criterion: dict[str, list[str]] = defaultdict(list)
    asked_concepts: set[str] = set()
    if session:
        for question in session.questions.select_related("planned_question__rubric_criterion").order_by("sequence"):
            planned = question.planned_question
            concept = (question.provenance or {}).get("concept") or (planned.concept if planned else "")
            if concept:
                asked_concepts.add(concept)
            if planned and planned.rubric_criterion_id:
                asked_by_criterion[str(planned.rubric_criterion_id)].append(str(question.id))

    rows = []
    for criterion in criteria:
        linked = asked_by_criterion.get(str(criterion.id), [])
        if len(linked) >= 2:
            coverage = "strong"
        elif len(linked) == 1:
            coverage = "moderate"
        else:
            # Soft match by category/name against asked concepts.
            soft = any(
                (criterion.name or "").lower() in concept.lower()
                or (criterion.category or "").lower() in concept.lower()
                for concept in asked_concepts
            )
            coverage = "weak" if soft else "not_assessed"
        rows.append(
            {
                "dimension": criterion.name,
                "category": criterion.category,
                "coverage": coverage,
                "question_ids": linked,
            }
        )
    if not rows:
        for concept in sorted(asked_concepts):
            rows.append(
                {
                    "dimension": concept,
                    "category": "topic",
                    "coverage": "moderate",
                    "question_ids": [],
                }
            )
    return rows


def create_flag(*, session: VivaSession, user, data: dict) -> EvidenceFlag:
    return EvidenceFlag.objects.create(
        viva_session=session,
        viva_question_id=data.get("viva_question"),
        answer_id=data.get("answer"),
        flag_type=data["flag_type"],
        severity=data.get("severity") or EvidenceFlag.Severity.MEDIUM,
        description=data["description"],
        supporting_evidence=data.get("supporting_evidence") or [],
        confidence=data.get("confidence") or "",
        created_by=user,
    )


def resolve_flag(*, flag: EvidenceFlag, user, status: str, note: str = "") -> EvidenceFlag:
    flag.status = status
    flag.resolved_by = user
    flag.resolved_at = timezone.now()
    flag.resolution_note = note or ""
    flag.save(update_fields=["status", "resolved_by", "resolved_at", "resolution_note", "updated_at"])
    return flag
