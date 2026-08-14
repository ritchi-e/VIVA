from __future__ import annotations

import uuid

from ai.service import AIService
from assignments.models import LearningOutcome
from orgs.models import Organization
from questions.models import PlannedQuestion, QuestionPlan
from rag.context import (
    build_concept_query,
    build_planning_query,
    format_chunks_for_prompt,
    retrieve_for_submission,
)
from rubrics.models import RubricCriterion
from submissions.metrics import CITATION_VALIDATION
from submissions.models import QuestionCandidate, Submission, SubmissionChunk

PLAN_SCHEMA = {
    "title": "question_plan",
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question_type": {"type": "string"},
                    "difficulty": {"type": "string"},
                    "concept": {"type": "string"},
                    "purpose": {"type": "string"},
                    "expected_evidence": {"type": "string"},
                    "source_artifact": {"type": "string"},
                    "source_ref": {"type": "string"},
                    "source_chunk_id": {"type": "string"},
                    "source_quote": {"type": "string"},
                    "rubric_criterion_name": {"type": "string"},
                    "learning_outcome_code": {"type": "string"},
                },
                "required": [
                    "question_type",
                    "concept",
                    "purpose",
                    "source_chunk_id",
                    "source_quote",
                ],
            },
        },
        "coverage": {"type": "object"},
    },
    "required": ["questions"],
}

WORDING_SCHEMA = {
    "title": "question_wording",
    "type": "object",
    "properties": {
        "question_text": {"type": "string"},
        "rationale": {"type": "string"},
    },
}

BATCH_WORDING_SCHEMA = {
    "title": "batch_question_wording",
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "planned_id": {"type": "string"},
                    "question_text": {"type": "string"},
                    "rationale": {"type": "string"},
                },
                "required": ["planned_id", "question_text"],
            },
        }
    },
    "required": ["questions"],
}

FOLLOW_UP_SCHEMA = {
    "title": "follow_up_wording",
    "type": "object",
    "properties": {
        "question_text": {"type": "string"},
        "rationale": {"type": "string"},
    },
}


def _match_rubric_criterion(name: str, criteria: list[RubricCriterion]) -> RubricCriterion | None:
    if not name:
        return None
    lowered = name.lower()
    for criterion in criteria:
        if criterion.name.lower() == lowered:
            return criterion
    for criterion in criteria:
        if lowered in criterion.name.lower() or criterion.name.lower() in lowered:
            return criterion
    return None


def _match_learning_outcome(code: str, outcomes: list[LearningOutcome]) -> LearningOutcome | None:
    if not code:
        return None
    for outcome in outcomes:
        if outcome.code.lower() == code.lower():
            return outcome
    return None


def _chunk_ids(chunks: list[dict]) -> list[str]:
    return [str(chunk.get("chunk_id")) for chunk in chunks if chunk.get("chunk_id")]


def _snippet(text: str, limit: int = 280) -> str:
    cleaned = " ".join((text or "").split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + "…"


def _chunks_for_planned_item(
    submission: Submission,
    organization: Organization,
    *,
    concept: str,
    purpose: str,
    question_type: str,
    source_chunk_id: str,
    source_quote: str,
    fallback_chunks: list[dict],
) -> list[dict]:
    """Prefer the cited chunk, then concept retrieval, then shared plan chunks."""
    selected: list[dict] = []
    seen: set[str] = set()

    def _add(chunk: dict | None):
        if not chunk:
            return
        cid = str(chunk.get("chunk_id") or "")
        if not cid or cid in seen:
            return
        seen.add(cid)
        selected.append(chunk)

    if source_chunk_id:
        try:
            uuid.UUID(str(source_chunk_id))
        except (ValueError, TypeError, AttributeError):
            matched = None
        else:
            matched = SubmissionChunk.objects.filter(submission=submission, pk=source_chunk_id).first()
            if matched:
                _add(
                    {
                        "chunk_id": str(matched.id),
                        "score": 1.0,
                        "content": matched.content,
                        "source_ref": matched.source_ref,
                        "chunk_index": matched.chunk_index,
                    }
                )

    # If we already have the cited chunk, fill from the shared plan retrieval
    # instead of issuing another embedding round-trip per question.
    if selected:
        for chunk in fallback_chunks:
            _add(chunk)
            if len(selected) >= 4:
                break
        return selected[:4]

    query = build_concept_query(concept, purpose, question_type, source_quote)
    if query:
        for chunk in retrieve_for_submission(submission, organization, query, top_k=4):
            _add(chunk)

    for chunk in fallback_chunks:
        _add(chunk)
        if len(selected) >= 4:
            break

    return selected[:4]


def plan_questions(
    submission: Submission,
    organization: Organization,
    *,
    viva_session=None,
    budget: int = 8,
) -> QuestionPlan:
    ai = AIService(organization=organization, user=submission.student)
    assignment = submission.assignment
    outcomes = list(LearningOutcome.objects.filter(assignment=assignment).order_by("order"))
    criteria = list(RubricCriterion.objects.filter(rubric__assignment=assignment).order_by("order"))

    planning_query = build_planning_query(submission)
    rag_chunks = retrieve_for_submission(submission, organization, planning_query, top_k=12)
    rag_chunks = _diversify_chunks(rag_chunks)
    excerpts = format_chunks_for_prompt(rag_chunks)

    outcome_lines = [f"- {lo.code}: {lo.description}" for lo in outcomes] or ["- None defined"]
    criterion_lines = [f"- {c.name} ({c.category})" for c in criteria] or ["- None defined"]
    repo_context = _repository_planner_context(submission)

    prompt = (
        f"Assignment: {assignment.title}\n"
        f"Instructions: {assignment.instructions or assignment.description or 'N/A'}\n\n"
        f"Learning outcomes:\n" + "\n".join(outcome_lines) + "\n\n"
        f"Rubric criteria:\n" + "\n".join(criterion_lines) + "\n\n"
        f"{repo_context}"
        f"## Submission excerpts (retrieved from the student's work)\n{excerpts}\n\n"
        f"Plan exactly {budget} oral viva questions that ONLY a student who wrote THIS submission could answer well.\n"
        "Requirements:\n"
        "- Every implementation question MUST be anchored to a concrete excerpt "
        "(function/class names, file paths, literals, control-flow choices).\n"
        "- Set source_quote to a short verbatim snippet copied from the Submission excerpts section ONLY.\n"
        "- Set source_chunk_id to that excerpt's id= value.\n"
        "- Set source_ref to the file path and line range when present (e.g. src/model.py:12-40).\n"
        "- Set source_artifact to github when the excerpt is from a repository file, otherwise submission.\n"
        "- Project-level questions (objective, architecture, data flow) are allowed only when multiple files "
        "or README evidence support them.\n"
        "- Assess understanding of the submitted implementation. Never claim the code executes correctly.\n"
        "- BAD: 'What is an AVL tree?' / 'Why did you choose C++?' / generic CS theory.\n"
        "- GOOD: ask about a named function, import edge, config value, or README claim that appears in excerpts.\n"
        "- Use varied question_type values: conceptual, methodology, implementation, results, "
        "critical_thinking, defense, limitations, application, submission_specific.\n"
        "- Map rubric_criterion_name and learning_outcome_code when relevant.\n"
        "- Do not ask textbook questions that ignore the excerpts."
    )

    result = ai.structured(
        [
            {
                "role": "system",
                "content": (
                    "You are an oral examiner planning personalized viva questions. "
                    "Questions must be grounded in the student's actual submission excerpts, "
                    "not general topic knowledge. "
                    "Respond with JSON shaped like "
                    '{"questions":[...],"coverage":{...}} — never echo the schema.'
                ),
            },
            {"role": "user", "content": prompt},
        ],
        PLAN_SCHEMA,
    )

    plan_data = result.data if isinstance(result.data, dict) else {}
    questions = plan_data.get("questions") or []
    if not isinstance(questions, list):
        questions = []
    if not questions:
        raise ValueError(
            "Question planning returned no questions. "
            "Check the AI provider response and try preparing the viva again."
        )

    plan = QuestionPlan.objects.create(
        submission=submission,
        viva_session=viva_session,
        plan=plan_data,
        coverage=plan_data.get("coverage", {}) or {},
        status="ready",
    )

    for idx, question in enumerate(questions[:budget]):
        qtype = question.get("question_type", PlannedQuestion.QuestionType.CONCEPTUAL)
        valid = {choice.value for choice in PlannedQuestion.QuestionType}
        if qtype not in valid:
            qtype = PlannedQuestion.QuestionType.CONCEPTUAL

        concept = question.get("concept", "").strip()
        purpose = question.get("purpose", "").strip()
        source_quote = (question.get("source_quote") or "").strip()
        chunk_id = question.get("source_chunk_id") or question.get("source_ref") or ""
        # Drop quotes that were not actually taken from retrieved submission text.
        corpus = "\n".join(chunk.get("content") or "" for chunk in rag_chunks)
        if source_quote and source_quote[:48] not in corpus:
            matched_chunk = next(
                (
                    chunk
                    for chunk in rag_chunks
                    if source_quote[:24] and source_quote[:24] in (chunk.get("content") or "")
                ),
                None,
            )
            if matched_chunk:
                chunk_id = matched_chunk.get("chunk_id") or chunk_id
            else:
                source_quote = ""
                CITATION_VALIDATION.labels(result="invalid_quote").inc()
        else:
            CITATION_VALIDATION.labels(result="valid").inc()
        if qtype == PlannedQuestion.QuestionType.IMPLEMENTATION and not source_quote and not chunk_id:
            CITATION_VALIDATION.labels(result="missing_implementation_citation").inc()
        concept_chunks = _chunks_for_planned_item(
            submission,
            organization,
            concept=concept,
            purpose=purpose,
            question_type=qtype,
            source_chunk_id=str(chunk_id),
            source_quote=source_quote,
            fallback_chunks=rag_chunks,
        )

        PlannedQuestion.objects.create(
            plan=plan,
            order=idx,
            question_type=qtype,
            difficulty=question.get("difficulty", "medium"),
            concept=concept,
            purpose=purpose,
            expected_evidence=question.get("expected_evidence", ""),
            source_artifact=question.get("source_artifact", "") or "submission",
            source_ref=question.get("source_ref", "") or (concept_chunks[0].get("source_ref") if concept_chunks else ""),
            rubric_criterion=_match_rubric_criterion(question.get("rubric_criterion_name", ""), criteria),
            learning_outcome=_match_learning_outcome(question.get("learning_outcome_code", ""), outcomes),
            metadata={
                "planned_by": "ai",
                "plan_schema": "question_plan",
                "source_quote": source_quote,
                "rag_chunks": concept_chunks,
                "rag_chunk_ids": _chunk_ids(concept_chunks),
                "source_chunk_id": chunk_id or (concept_chunks[0].get("chunk_id") if concept_chunks else None),
            },
        )

    return plan


def word_planned_question(planned: PlannedQuestion, organization: Organization) -> PlannedQuestion:
    if planned.wording:
        return planned

    submission = planned.plan.submission
    rag_chunks = planned.metadata.get("rag_chunks") or []
    source_quote = (planned.metadata or {}).get("source_quote") or ""
    if not rag_chunks and planned.concept:
        rag_chunks = retrieve_for_submission(
            submission,
            organization,
            build_concept_query(planned.concept, planned.purpose, planned.question_type, source_quote),
            top_k=4,
        )
        planned.metadata = {**planned.metadata, "rag_chunks": rag_chunks, "rag_chunk_ids": _chunk_ids(rag_chunks)}

    excerpts = format_chunks_for_prompt(rag_chunks, max_chars=6000)
    ai = AIService(organization=organization, user=submission.student)
    result = ai.structured(
        [
            {
                "role": "system",
                "content": (
                    "Turn planning metadata into one clear, conversational viva question. "
                    "The question must reference a specific detail from the submission excerpts "
                    "(names, values, code paths, or quoted wording). "
                    "Never ask a generic topic question."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Assignment: {submission.assignment.title}\n"
                    f"Type: {planned.question_type}\n"
                    f"Concept: {planned.concept}\n"
                    f"Purpose: {planned.purpose}\n"
                    f"Expected evidence: {planned.expected_evidence}\n"
                    f"Source quote from submission: {source_quote or 'N/A'}\n\n"
                    f"## Submission excerpts\n{excerpts}\n\n"
                    "Write a single oral exam question that names a concrete detail from the excerpts "
                    "and asks the student to explain or defend it. Do not use placeholder text."
                ),
            },
        ],
        WORDING_SCHEMA,
    )

    planned.wording = result.data.get("question_text", "").strip() or _fallback_wording(planned, rag_chunks)
    planned.metadata = {
        **planned.metadata,
        "wording_rationale": result.data.get("rationale", ""),
        "provenance": "ai.wording",
        "rag_chunks": rag_chunks,
        "rag_chunk_ids": _chunk_ids(rag_chunks),
    }
    planned.save(update_fields=["wording", "metadata", "updated_at"])
    return planned


def word_all_planned_questions(plan: QuestionPlan, organization: Organization) -> list[PlannedQuestion]:
    """Word all planned questions in a single AI call to keep prepare fast."""
    pending = list(plan.questions.filter(is_follow_up=False, wording="").order_by("order"))
    if not pending:
        return list(plan.questions.filter(is_follow_up=False).order_by("order"))

    submission = plan.submission
    items = []
    for planned in pending:
        rag_chunks = planned.metadata.get("rag_chunks") or []
        source_quote = (planned.metadata or {}).get("source_quote") or ""
        if not rag_chunks:
            rag_chunks = retrieve_for_submission(
                submission,
                organization,
                build_concept_query(planned.concept, planned.purpose, planned.question_type, source_quote),
                top_k=3,
            )
            planned.metadata = {
                **planned.metadata,
                "rag_chunks": rag_chunks,
                "rag_chunk_ids": _chunk_ids(rag_chunks),
            }
            planned.save(update_fields=["metadata", "updated_at"])
        primary = rag_chunks[0] if rag_chunks else {}
        items.append(
            {
                "planned_id": str(planned.id),
                "type": planned.question_type,
                "concept": planned.concept,
                "purpose": planned.purpose,
                "expected_evidence": planned.expected_evidence,
                "source_quote": source_quote,
                "excerpt_id": primary.get("chunk_id"),
                "excerpt_ref": primary.get("source_ref"),
                "excerpt_snippet": _snippet(primary.get("content") or source_quote, 320),
            }
        )

    shared_chunks = retrieve_for_submission(
        submission,
        organization,
        build_planning_query(submission),
        top_k=10,
    )
    excerpts = format_chunks_for_prompt(shared_chunks, max_chars=9000)

    ai = AIService(organization=organization, user=submission.student)
    try:
        result = ai.structured(
            [
                {
                    "role": "system",
                    "content": (
                        "Write clear oral viva questions for each planning item. "
                        "Each question MUST mention a concrete detail from that item's "
                        "source_quote or excerpt_snippet (function names, literals, code paths). "
                        "Do not write generic textbook questions. "
                        "Return one question_text per planned_id."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Assignment: {submission.assignment.title}\n\n"
                        f"## Submission excerpts\n{excerpts}\n\n"
                        f"## Planned items (each already tied to a submission snippet)\n{items}"
                    ),
                },
            ],
            BATCH_WORDING_SCHEMA,
        )
        by_id = {
            str(item.get("planned_id")): item
            for item in (result.data or {}).get("questions", [])
            if item.get("planned_id")
        }
    except Exception:
        by_id = {}

    for planned in pending:
        data = by_id.get(str(planned.id))
        if data and data.get("question_text"):
            planned.wording = str(data["question_text"]).strip()
            planned.metadata = {
                **planned.metadata,
                "wording_rationale": data.get("rationale", ""),
                "provenance": "ai.batch_wording",
                "rag_chunks": planned.metadata.get("rag_chunks") or shared_chunks,
                "rag_chunk_ids": _chunk_ids(planned.metadata.get("rag_chunks") or shared_chunks),
            }
            planned.save(update_fields=["wording", "metadata", "updated_at"])
        else:
            word_planned_question(planned, organization)

    return list(plan.questions.filter(is_follow_up=False).order_by("order"))


def word_follow_up_question(
    planned: PlannedQuestion,
    organization: Organization,
    *,
    original_question: str,
    student_answer: str,
    submission: Submission,
) -> PlannedQuestion:
    if planned.wording:
        return planned

    rag_chunks = retrieve_for_submission(
        submission,
        organization,
        build_concept_query(
            planned.concept,
            f"{planned.purpose} {student_answer[:300]}",
            planned.question_type,
            (planned.metadata or {}).get("source_quote", ""),
        ),
        top_k=4,
    )
    excerpts = format_chunks_for_prompt(rag_chunks, max_chars=5000)
    ai = AIService(organization=organization, user=submission.student)
    result = ai.structured(
        [
            {
                "role": "system",
                "content": (
                    "Write a targeted follow-up viva question because the student's answer was shallow. "
                    "Probe for specific evidence from their submission."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Original question: {original_question}\n"
                    f"Student answer: {student_answer}\n"
                    f"Concept: {planned.concept}\n"
                    f"Purpose: {planned.purpose}\n\n"
                    f"## Submission excerpts\n{excerpts}\n\n"
                    "Ask one follow-up that forces the student to point to a concrete detail "
                    "from their submission."
                ),
            },
        ],
        FOLLOW_UP_SCHEMA,
    )

    planned.wording = result.data.get("question_text", "").strip() or (
        f"Can you point to a specific part of your submission that supports your answer about {planned.concept}?"
    )
    planned.metadata = {
        **planned.metadata,
        "wording_rationale": result.data.get("rationale", ""),
        "provenance": "ai.follow_up",
        "rag_chunks": rag_chunks,
        "rag_chunk_ids": _chunk_ids(rag_chunks),
    }
    planned.save(update_fields=["wording", "metadata", "updated_at"])
    return planned


def _fallback_wording(planned: PlannedQuestion, rag_chunks: list[dict]) -> str:
    quote = (planned.metadata or {}).get("source_quote") or ""
    if quote:
        return (
            f"In your submission you wrote something like “{_snippet(quote, 160)}”. "
            f"Can you walk me through what that is doing and why you designed it that way?"
        )
    if rag_chunks and rag_chunks[0].get("content"):
        return (
            f"Looking at this part of your submission — “{_snippet(rag_chunks[0]['content'], 160)}” — "
            f"can you explain how it relates to {planned.concept or 'your approach'}?"
        )
    return (
        f"Can you walk me through how your submission handles {planned.concept or 'this part of the work'}?"
    )


def _diversify_chunks(chunks: list[dict]) -> list[dict]:
    seen: set[str] = set()
    ordered: list[dict] = []
    for chunk in chunks:
        key = chunk.get("path") or chunk.get("source_ref") or chunk.get("chunk_id") or ""
        if key in seen:
            continue
        seen.add(str(key))
        ordered.append(chunk)
    for chunk in chunks:
        if chunk not in ordered:
            ordered.append(chunk)
    return ordered


def _repository_planner_context(submission: Submission) -> str:
    from django.core.exceptions import ObjectDoesNotExist

    try:
        snapshot = submission.repository
    except ObjectDoesNotExist:
        snapshot = None
    if not snapshot:
        return ""
    from submissions.repository.profile import profile_summary_text

    profile = profile_summary_text(snapshot.project_profile or {})
    candidates = list(QuestionCandidate.objects.filter(submission=submission).order_by("created_at")[:12])
    lines = ["## Repository context (static analysis; code was not executed)\n", profile, ""]
    if candidates:
        lines.append("Question candidate hints:")
        for candidate in candidates:
            lines.append(f"- [{candidate.level}] {candidate.prompt_hint} (ref={candidate.source_ref})")
        lines.append("")
    return "\n".join(lines) + "\n"
