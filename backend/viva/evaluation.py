from __future__ import annotations

import logging

from ai.service import AIService
from orgs.models import Organization
from rag.context import build_concept_query, format_chunks_for_prompt, retrieve_for_submission
from viva.models import AnswerEvaluation, StudentAnswer, VivaQuestion, VivaSession

logger = logging.getLogger(__name__)

EVAL_SCHEMA = {
    "title": "answer_evaluation",
    "type": "object",
    "properties": {
        "conceptual_accuracy": {"type": "number"},
        "evidence_support": {"type": "number"},
        "depth": {"type": "number"},
        "relevance": {"type": "number"},
        "overall": {"type": "number"},
        "requires_follow_up": {"type": "boolean"},
        "explanation": {"type": "string"},
        "evidence_refs": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "conceptual_accuracy",
        "evidence_support",
        "depth",
        "relevance",
        "overall",
        "requires_follow_up",
        "explanation",
    ],
}

BATCH_EVAL_SCHEMA = {
    "title": "batch_answer_evaluation",
    "type": "object",
    "properties": {
        "evaluations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question_id": {"type": "string"},
                    "conceptual_accuracy": {"type": "number"},
                    "evidence_support": {"type": "number"},
                    "depth": {"type": "number"},
                    "relevance": {"type": "number"},
                    "overall": {"type": "number"},
                    "requires_follow_up": {"type": "boolean"},
                    "explanation": {"type": "string"},
                    "evidence_refs": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "question_id",
                    "conceptual_accuracy",
                    "evidence_support",
                    "depth",
                    "relevance",
                    "overall",
                    "requires_follow_up",
                    "explanation",
                ],
            },
        }
    },
    "required": ["evaluations"],
}


def _clamp(value, low: float = 0.0, high: float = 10.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return low
    return max(low, min(high, number))


def _save_evaluation(answer: StudentAnswer, data: dict) -> AnswerEvaluation:
    evaluation, _created = AnswerEvaluation.objects.update_or_create(
        answer=answer,
        defaults={
            "conceptual_accuracy": _clamp(data.get("conceptual_accuracy", 0)),
            "evidence_support": _clamp(data.get("evidence_support", 0)),
            "depth": _clamp(data.get("depth", 0)),
            "relevance": _clamp(data.get("relevance", 0)),
            "overall": _clamp(data.get("overall", 0)),
            "requires_follow_up": bool(data.get("requires_follow_up", False)),
            "explanation": str(data.get("explanation", "")).strip(),
            "evidence_refs": data.get("evidence_refs", []) if isinstance(data.get("evidence_refs"), list) else [],
            "raw": data,
            "is_ai_generated": True,
        },
    )
    return evaluation


def evaluate_answer(answer: StudentAnswer, organization: Organization) -> AnswerEvaluation:
    """Single-answer evaluation (used as fallback if batch fails for one item)."""
    vq: VivaQuestion = answer.attempt.question
    session = vq.session
    submission = session.submission
    assignment = session.assignment
    provenance = vq.provenance or {}
    rag_chunks = provenance.get("rag_chunks") or provenance.get("metadata", {}).get("rag_chunks") or []
    if not rag_chunks and vq.planned_question:
        rag_chunks = vq.planned_question.metadata.get("rag_chunks") or []
    if not rag_chunks:
        rag_chunks = retrieve_for_submission(
            submission,
            organization,
            build_concept_query(vq.question_text, answer.text[:300]),
            top_k=4,
        )
    excerpts = format_chunks_for_prompt(rag_chunks, max_chars=5000)
    concept = provenance.get("concept") or ""
    purpose = provenance.get("purpose") or ""

    ai = AIService(organization=organization, user=session.student)
    result = ai.structured(
        [
            {
                "role": "system",
                "content": (
                    "You are an experienced oral examiner assessing a student's viva answer.\n"
                    "Score each dimension from 0 to 10 using the submission excerpts as evidence.\n"
                    "Be strict but fair. Return ONLY valid JSON matching the schema."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Assignment: {assignment.title}\n"
                    f"Question type: {vq.question_type}\n"
                    f"Concept focus: {concept or 'n/a'}\n"
                    f"Purpose: {purpose or 'n/a'}\n\n"
                    f"Question:\n{vq.question_text}\n\n"
                    f"Student answer:\n{answer.text}\n\n"
                    f"## Submission excerpts for reference\n{excerpts}\n\n"
                    "Evaluate conceptual_accuracy, evidence_support, depth, relevance, and overall (0-10)."
                ),
            },
        ],
        EVAL_SCHEMA,
        temperature=0.2,
    )
    return _save_evaluation(answer, result.data or {})


def evaluate_session_answers(session: VivaSession, organization: Organization) -> list[AnswerEvaluation]:
    """
    Batch-evaluate all answers for a completed viva in one AI call.
    Falls back to per-answer evaluation if the batch response is incomplete.
    """
    pairs: list[tuple[VivaQuestion, StudentAnswer]] = []
    for question in session.questions.prefetch_related("attempts__answers").order_by("sequence"):
        attempt = question.attempts.order_by("-attempt_number").first()
        if not attempt:
            continue
        answer = attempt.answers.order_by("-submitted_at").first()
        if not answer:
            continue
        pairs.append((question, answer))

    if not pairs:
        return []

    submission = session.submission
    assignment = session.assignment
    planning_chunks = retrieve_for_submission(
        submission,
        organization,
        f"{assignment.title} viva answers",
        top_k=8,
    )
    excerpts = format_chunks_for_prompt(planning_chunks, max_chars=8000)

    dialogue_blocks = []
    for question, answer in pairs:
        provenance = question.provenance or {}
        dialogue_blocks.append(
            "\n".join(
                [
                    f"question_id: {question.id}",
                    f"sequence: {question.sequence}",
                    f"type: {question.question_type}",
                    f"concept: {provenance.get('concept') or 'n/a'}",
                    f"Question: {question.question_text}",
                    f"Student answer: {answer.text}",
                ]
            )
        )

    ai = AIService(organization=organization, user=session.student)
    try:
        result = ai.structured(
            [
                {
                    "role": "system",
                    "content": (
                        "You are an experienced oral examiner. Evaluate EVERY student answer in the viva "
                        "dialogue below. Score each dimension 0-10 using the submission excerpts. "
                        "Return one evaluation object per question_id. Return ONLY valid JSON."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Assignment: {assignment.title}\n\n"
                        f"## Submission excerpts\n{excerpts}\n\n"
                        f"## Viva dialogue\n\n" + "\n\n---\n\n".join(dialogue_blocks)
                    ),
                },
            ],
            BATCH_EVAL_SCHEMA,
            temperature=0.2,
        )
        by_qid = {
            str(item.get("question_id")): item
            for item in (result.data or {}).get("evaluations", [])
            if item.get("question_id")
        }
    except Exception:
        logger.exception("Batch viva evaluation failed; falling back to per-answer evaluation")
        by_qid = {}

    evaluations: list[AnswerEvaluation] = []
    for question, answer in pairs:
        data = by_qid.get(str(question.id))
        if data:
            evaluations.append(_save_evaluation(answer, data))
        else:
            try:
                evaluations.append(evaluate_answer(answer, organization))
            except Exception:
                logger.exception("Fallback evaluation failed for answer %s", answer.id)
    return evaluations
