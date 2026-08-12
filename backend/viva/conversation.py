from __future__ import annotations

import logging
import re
from typing import Any

from django.conf import settings

from ai.service import AIService
from orgs.models import Organization
from questions.models import PlannedQuestion, QuestionPlan
from rag.context import (
    build_concept_query,
    format_chunks_for_conversation,
    retrieve_for_submission,
)
from viva.models import StudentAnswer, VivaQuestion, VivaSession

logger = logging.getLogger(__name__)

NEXT_TURN_SCHEMA = {
    "title": "viva_next_turn",
    "type": "object",
    "properties": {
        "answer_analysis": {
            "type": "object",
            "properties": {
                "quality": {"type": "string"},
                "covered": {"type": "array", "items": {"type": "string"}},
                "missing": {"type": "array", "items": {"type": "string"}},
                "misconception": {"type": "string"},
                "student_phrase": {"type": "string"},
            },
            "required": ["quality"],
        },
        "mode": {"type": "string"},
        "planned_id": {"type": "string"},
        "acknowledgment": {"type": "string"},
        "question_text": {"type": "string"},
        "excerpt_quote": {"type": "string"},
        "excerpt_chunk_id": {"type": "string"},
        "rationale": {"type": "string"},
    },
    "required": ["answer_analysis", "mode", "question_text"],
}

_QUALITY_FOLLOW_UP = frozenset({"weak", "non_answer", "partial"})


def _dialogue_blocks(session: VivaSession, *, limit: int = 8) -> list[str]:
    blocks: list[str] = []
    questions = list(session.questions.prefetch_related("attempts__answers").order_by("sequence"))
    for question in questions[-limit:]:
        attempt = question.attempts.order_by("-attempt_number").first()
        answer = attempt.answers.order_by("-submitted_at").first() if attempt else None
        answer_text = (answer.text if answer else "").strip() or "[no answer yet]"
        blocks.append(
            f"Examiner Q{question.sequence}: {question.question_text}\n"
            f"Student: {answer_text}"
        )
    return blocks


def _asked_questions(session: VivaSession) -> list[dict[str, Any]]:
    asked: list[dict[str, Any]] = []
    for question in session.questions.order_by("sequence"):
        provenance = question.provenance or {}
        asked.append(
            {
                "sequence": question.sequence,
                "concept": provenance.get("concept") or "",
                "text": question.question_text,
            }
        )
    return asked


def _unused_planned(
    plan: QuestionPlan,
    session: VivaSession,
    *,
    covered_concepts: set[str] | None = None,
) -> list[PlannedQuestion]:
    used_ids = list(
        session.questions.exclude(planned_question_id=None).values_list("planned_question_id", flat=True)
    )
    items = list(
        plan.questions.exclude(id__in=used_ids)
        .exclude(is_follow_up=True)
        .order_by("order")
    )
    if covered_concepts:
        items = [item for item in items if item.concept not in covered_concepts]
    return items


def _coverage_state(session: VivaSession) -> dict[str, Any]:
    state = session.coverage_state or {}
    if not isinstance(state, dict):
        return {}
    return state


def _answer_is_shallow(text: str) -> bool:
    """Heuristic hint for the model — not the sole follow-up decision."""
    words = re.findall(r"[A-Za-z0-9']+", text or "")
    if len(words) < 18:
        return True
    lowered = text.lower()
    vague = ("i don't know", "not sure", "no idea", "maybe", "idk")
    return any(phrase in lowered for phrase in vague) and len(words) < 40


def _normalize_tokens(text: str) -> set[str]:
    return {t.lower() for t in re.findall(r"[a-zA-Z0-9']+", text or "") if len(t) > 2}


def _is_duplicate(candidate: str, previous: list[str], *, threshold: float = 0.55) -> bool:
    """Token-set Jaccard similarity against prior question texts."""
    cand_tokens = _normalize_tokens(candidate)
    if not cand_tokens:
        return False
    for prev in previous:
        prev_tokens = _normalize_tokens(prev)
        if not prev_tokens:
            continue
        intersection = len(cand_tokens & prev_tokens)
        union = len(cand_tokens | prev_tokens)
        if union and intersection / union >= threshold:
            return True
    return False


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _verify_quote(quote: str, chunks: list[dict[str, Any]]) -> bool:
    normalized = _normalize_whitespace(quote).lower()
    if len(normalized) < 8:
        return False
    for chunk in chunks:
        content = _normalize_whitespace(chunk.get("content") or "").lower()
        if normalized in content:
            return True
    return False


def _find_chunk_for_quote(quote: str, chunks: list[dict[str, Any]]) -> dict[str, Any] | None:
    normalized = _normalize_whitespace(quote).lower()
    if not normalized:
        return None
    for chunk in chunks:
        content = _normalize_whitespace(chunk.get("content") or "").lower()
        if normalized in content:
            return chunk
    return None


_EXCERPT_LABEL_RE = re.compile(
    r"(?:as\s+shown\s+in\s+the\s+excerpt\s+above|"
    r"in\s+excerpt\s+\d+|"
    r"referring\s+to\s+excerpt\s+\d+|"
    r"excerpt\s+\d+\s+(?:shows|mentions|says|describes)|"
    r"from\s+excerpt\s+\d+|"
    r"the\s+excerpt\s+above)\b[.,;:]?\s*",
    re.IGNORECASE,
)


def _strip_excerpt_labels(text: str) -> str:
    cleaned = _EXCERPT_LABEL_RE.sub("", text or "")
    return re.sub(r"\s+", " ", cleaned).strip()


def _compose_spoken(acknowledgment: str, question_text: str) -> str:
    question_text = (question_text or "").strip()
    acknowledgment = (acknowledgment or "").strip()
    if not acknowledgment:
        return question_text
    if acknowledgment.endswith((".", "!", "?")):
        return f"{acknowledgment} {question_text}".strip()
    return f"{acknowledgment}. {question_text}".strip()


_CLICHE_OPENERS = re.compile(
    r"^(?:nice|good|great|excellent|well\s+done|thanks|thank\s+you|i\s+see|i\s+notice)"
    r"(?:\s+(?:start|focus|point|job|work|answer|effort|try))?\b[\s,—:-]*",
    re.IGNORECASE,
)


def _sanitize_acknowledgment(text: str) -> str:
    """Drop or shorten examiner acknowledgments that sound robotic."""
    cleaned = (text or "").strip()
    if not cleaned:
        return ""
    if _CLICHE_OPENERS.match(cleaned):
        return ""
    if re.search(r"\bnice\b", cleaned, re.IGNORECASE):
        return ""
    words = cleaned.split()
    if len(words) > 12:
        cleaned = " ".join(words[:12]).rstrip(",—-")
    return cleaned


def _limit_questions(text: str, *, max_questions: int = 1) -> str:
    cleaned = " ".join((text or "").split()).strip()
    if not cleaned:
        return ""
    if "?" not in cleaned:
        return cleaned
    parts: list[str] = []
    for chunk in re.split(r"\?\s*", cleaned):
        chunk = chunk.strip(" .")
        if not chunk:
            continue
        parts.append(chunk + "?")
        if len(parts) >= max_questions:
            break
    return " ".join(parts)


def _sanitize_question_text(text: str, *, max_questions: int = 1) -> str:
    cleaned = " ".join((text or "").split()).strip()
    if not cleaned:
        return ""
    cleaned = _strip_excerpt_labels(cleaned)
    cleaned = _CLICHE_OPENERS.sub("", cleaned).strip()
    cleaned = re.sub(
        r"^(?:now,?\s*)?(?:let(?:'s| us)\s+(?:move on|turn to|look at)\s*)",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    question_marks = cleaned.count("?")
    if question_marks > max_questions:
        cleaned = _limit_questions(cleaned, max_questions=max_questions)
    elif question_marks == 0 and re.search(r"\b(explain|describe|walk me through|why|how)\b", cleaned, re.I):
        cleaned = cleaned.rstrip(".") + "?"
    words = cleaned.split()
    if len(words) > 42:
        trimmed = " ".join(words[:42])
        if "?" not in trimmed:
            trimmed = trimmed.rstrip(",.") + "?"
        cleaned = trimmed
    return cleaned


def _polish_turn(
    acknowledgment: str,
    question_text: str,
    *,
    max_questions: int = 1,
) -> tuple[str, str]:
    acknowledgment = _sanitize_acknowledgment(acknowledgment)
    question_text = _sanitize_question_text(question_text, max_questions=max_questions)
    return acknowledgment, question_text


def _mode_from_analysis(analysis: dict[str, Any]) -> str:
    quality = str(analysis.get("quality") or "").lower()
    if quality in _QUALITY_FOLLOW_UP:
        return "follow_up"
    if quality == "strong":
        return "advance"
    return "advance"


def _build_excerpt(
    quote: str,
    chunk_id: str,
    chunks: list[dict[str, Any]],
    *,
    fallback_quote: str = "",
) -> dict[str, str]:
    quote = (quote or "").strip()
    if quote and not _verify_quote(quote, chunks):
        quote = ""
    if not quote and fallback_quote:
        quote = fallback_quote.strip()
        if quote and not _verify_quote(quote, chunks):
            quote = fallback_quote[:120].strip()
    chunk = _find_chunk_for_quote(quote, chunks) if quote else None
    if chunk is None and chunk_id:
        chunk = next((c for c in chunks if str(c.get("chunk_id")) == str(chunk_id)), None)
    if chunk is None and chunks:
        chunk = chunks[0]
    if not quote and chunk:
        content = (chunk.get("content") or "").strip()
        quote = content[:200].strip()
    resolved_chunk_id = str((chunk or {}).get("chunk_id") or chunk_id or "")
    source_ref = str((chunk or {}).get("source_ref") or "")
    return {
        "quote": quote,
        "chunk_id": resolved_chunk_id,
        "source_ref": source_ref,
    }


def _fallback_question(
    planned: PlannedQuestion | None,
    last_answer: str = "",
    *,
    chunks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    quote = ""
    chunk_id = ""
    if planned:
        quote = (planned.metadata or {}).get("source_quote") or ""
        chunk_id = (planned.metadata or {}).get("source_chunk_id") or ""
    excerpt = _build_excerpt(quote, chunk_id, chunks or [], fallback_quote=quote)
    display_quote = excerpt.get("quote") or (planned.concept if planned else "your submission")
    if planned:
        text = (
            f"In your submission you wrote “{str(display_quote)[:120]}”. "
            "Walk me through what that part is doing."
        )
        return {
            "mode": "advance",
            "planned_id": str(planned.id),
            "question_text": text,
            "acknowledgment": "",
            "excerpt_quote": excerpt.get("quote") or "",
            "excerpt_chunk_id": excerpt.get("chunk_id") or "",
            "answer_analysis": {
                "quality": "partial",
                "covered": [],
                "missing": [],
                "misconception": "",
                "student_phrase": "",
            },
        }
    return {
        "mode": "advance",
        "question_text": (
            "Can you point to a specific part of your submission and explain a key design choice you made?"
        ),
        "acknowledgment": "",
        "excerpt_quote": "",
        "excerpt_chunk_id": "",
        "answer_analysis": {
            "quality": "partial",
            "covered": [],
            "missing": [],
            "misconception": "",
            "student_phrase": "",
        },
    }


def _follow_up_cap(session: VivaSession) -> int:
    return max(1, session.question_budget // 3)


def _follow_up_cap_reached(session: VivaSession) -> bool:
    coverage = _coverage_state(session)
    consecutive = int(coverage.get("consecutive_follow_ups") or 0)
    follow_up_total = int(coverage.get("follow_up_total") or 0)
    if consecutive >= 2:
        return True
    return follow_up_total >= _follow_up_cap(session)


def generate_next_turn(
    session: VivaSession,
    organization: Organization,
    *,
    plan: QuestionPlan,
) -> dict[str, Any]:
    """
    Decide the examiner's next spoken turn from dialogue history + remaining coverage plan.

    Returns dict with mode, planned_id, question_text, acknowledgment, rationale, rag_chunks,
    excerpt, answer_analysis, and parent_planned.
    """
    coverage = _coverage_state(session)
    covered_concepts = set(coverage.get("covered_concepts") or [])
    follow_up_cap = _follow_up_cap(session)

    unused = _unused_planned(plan, session, covered_concepts=covered_concepts)
    asked = _asked_questions(session)
    prior_texts = [item["text"] for item in asked]
    dialogue = _dialogue_blocks(session, limit=4)

    last_answer = ""
    last_answer_id: str | None = None
    last_question = session.questions.order_by("-sequence").first()
    if last_question:
        attempt = last_question.attempts.order_by("-attempt_number").first()
        answer: StudentAnswer | None = (
            attempt.answers.order_by("-submitted_at").first() if attempt else None
        )
        if answer:
            last_answer = answer.text or ""
            last_answer_id = str(answer.id)

    shallow_hint = bool(dialogue) and _answer_is_shallow(last_answer) and last_question is not None
    must_advance = _follow_up_cap_reached(session)

    focus = unused[0] if unused else None
    if last_question and last_question.planned_question_id and not must_advance:
        focus = last_question.planned_question or focus

    source_quote = ""
    rag_chunks: list[dict] = []
    if focus:
        source_quote = (focus.metadata or {}).get("source_quote") or ""
        rag_chunks = list((focus.metadata or {}).get("rag_chunks") or [])
        if not rag_chunks:
            rag_chunks = retrieve_for_submission(
                session.submission,
                organization,
                build_concept_query(focus.concept, focus.purpose, focus.question_type, source_quote),
                top_k=3,
            )
    if not rag_chunks:
        rag_chunks = retrieve_for_submission(
            session.submission,
            organization,
            last_answer[:300] or session.assignment.title,
            top_k=4,
        )

    excerpts = format_chunks_for_conversation(rag_chunks, max_chars=4500)
    remaining = [
        {
            "planned_id": str(item.id),
            "type": item.question_type,
            "concept": item.concept,
            "purpose": item.purpose,
            "source_quote": (item.metadata or {}).get("source_quote") or "",
        }
        for item in unused[:5]
    ]

    already_asked_block = "\n".join(
        f"- Q{item['sequence']}: [{item['concept']}] {item['text']}" for item in asked
    ) or "(none yet)"

    shallow_note = (
        "Heuristic: the last answer looks thin or vague — lean toward follow_up unless coverage is solid."
        if shallow_hint
        else ""
    )
    advance_note = (
        "Server constraint: too many follow-ups already — mode must be advance."
        if must_advance
        else ""
    )

    ai = AIService(organization=organization, user=session.student)
    try:
        result = ai.structured(
            [
                {
                    "role": "system",
                    "content": (
                        "You are a live oral examiner in a viva voce. "
                        "Speak naturally but professionally — like a real examiner, not a chatbot.\n"
                        "Workflow:\n"
                        "1. If there is a student answer, fill answer_analysis first (what they covered, "
                        "missed, misconceptions, a short student_phrase they used).\n"
                        "2. Choose mode from answer_analysis.quality: weak/non_answer/partial -> follow_up; "
                        "strong -> advance.\n"
                        "3. Frame question_text from missing points or the next planned topic.\n"
                        "Rules:\n"
                        "- question_text: ONE spoken question (max TWO if tightly related). Under 35 words.\n"
                        "- Never reference excerpts by number (no 'Excerpt 2'). Quote the actual snippet.\n"
                        "- excerpt_quote: short verbatim snippet from Submission excerpts when grounding the question.\n"
                        "- acknowledgment: optional, max 12 words, paraphrase something the student said; "
                        "no Nice/Good/Great/Thanks clichés. Empty for opening question.\n"
                        "- Do not repeat any question listed under Already asked.\n"
                        "Return JSON instance only — never echo the schema."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Assignment: {session.assignment.title}\n"
                        f"Questions asked so far: {session.questions_asked}/"
                        f"{session.question_budget}\n\n"
                        f"## Dialogue so far\n"
                        + ("\n\n".join(dialogue) if dialogue else "(This is the opening question.)")
                        + "\n\n"
                        f"## Already asked (do not repeat)\n{already_asked_block}\n\n"
                        f"## Remaining coverage topics (use planned_id when advancing)\n{remaining}\n\n"
                        f"## Submission excerpts\n{excerpts}\n\n"
                        + (f"Note: {shallow_note}\n" if shallow_note else "")
                        + (f"Constraint: {advance_note}\n" if advance_note else "")
                        + "\nReturn answer_analysis, mode, planned_id, acknowledgment, question_text, "
                        "excerpt_quote, excerpt_chunk_id, rationale."
                    ),
                },
            ],
            NEXT_TURN_SCHEMA,
            model=getattr(settings, "OPENAI_VIVA_MODEL", None) or getattr(settings, "OPENAI_CHAT_MODEL", None),
        )
        data = result.data if isinstance(result.data, dict) else {}
    except Exception:
        logger.exception("Conversational next-turn generation failed; using fallback")
        data = _fallback_question(focus, last_answer, chunks=rag_chunks)

    answer_analysis = data.get("answer_analysis") if isinstance(data.get("answer_analysis"), dict) else {}
    mode = str(data.get("mode") or _mode_from_analysis(answer_analysis)).lower()
    if mode not in ("follow_up", "advance", "complete"):
        mode = _mode_from_analysis(answer_analysis)
    if must_advance and mode == "follow_up":
        mode = "advance"
    if not dialogue:
        mode = "advance"
    if mode == "advance" and not unused and session.questions_asked > 0:
        return {
            "mode": "complete",
            "question_text": "",
            "acknowledgment": "",
            "bridge": "",
            "rag_chunks": rag_chunks,
            "answer_analysis": answer_analysis,
            "triggering_answer_id": last_answer_id,
        }

    planned_id = str(data.get("planned_id") or "")
    planned = None
    if mode == "advance":
        if planned_id:
            planned = next((item for item in unused if str(item.id) == planned_id), None)
        if planned is None and unused:
            planned = unused[0]
            planned_id = str(planned.id)
    elif last_question and last_question.planned_question_id:
        planned = last_question.planned_question
        planned_id = str(planned.id) if planned else planned_id

    question_text = (data.get("question_text") or "").strip()
    acknowledgment = (data.get("acknowledgment") or data.get("bridge") or "").strip()
    excerpt_quote = (data.get("excerpt_quote") or "").strip()
    excerpt_chunk_id = (data.get("excerpt_chunk_id") or "").strip()

    if not question_text:
        fallback = _fallback_question(planned or focus, last_answer, chunks=rag_chunks)
        question_text = fallback["question_text"]
        acknowledgment = acknowledgment or fallback.get("acknowledgment") or ""
        excerpt_quote = excerpt_quote or fallback.get("excerpt_quote") or ""
        excerpt_chunk_id = excerpt_chunk_id or fallback.get("excerpt_chunk_id") or ""
        planned_id = planned_id or fallback.get("planned_id") or ""
        if not answer_analysis:
            answer_analysis = fallback.get("answer_analysis") or {}
        if planned_id and planned is None:
            planned = next((item for item in unused if str(item.id) == planned_id), planned)

    fallback_quote = (planned.metadata or {}).get("source_quote") if planned else source_quote
    excerpt = _build_excerpt(
        excerpt_quote,
        excerpt_chunk_id,
        rag_chunks,
        fallback_quote=fallback_quote or "",
    )

    max_q = 2 if mode == "follow_up" else 1
    acknowledgment, question_text = _polish_turn(acknowledgment, question_text, max_questions=max_q)

    if _is_duplicate(question_text, prior_texts):
        logger.info("Duplicate question detected; falling back to next topic")
        if mode == "follow_up" and unused:
            mode = "advance"
            planned = unused[0]
            planned_id = str(planned.id)
            fallback = _fallback_question(planned, last_answer, chunks=rag_chunks)
            question_text = fallback["question_text"]
            acknowledgment = ""
            excerpt = _build_excerpt(
                fallback.get("excerpt_quote") or "",
                fallback.get("excerpt_chunk_id") or "",
                rag_chunks,
                fallback_quote=(planned.metadata or {}).get("source_quote") or "",
            )
            acknowledgment, question_text = _polish_turn(acknowledgment, question_text, max_questions=1)
        elif unused:
            for alt in unused:
                alt_fallback = _fallback_question(alt, last_answer, chunks=rag_chunks)
                alt_text = alt_fallback["question_text"]
                if not _is_duplicate(alt_text, prior_texts):
                    planned = alt
                    planned_id = str(alt.id)
                    question_text = alt_text
                    acknowledgment = ""
                    excerpt = _build_excerpt(
                        alt_fallback.get("excerpt_quote") or "",
                        alt_fallback.get("excerpt_chunk_id") or "",
                        rag_chunks,
                        fallback_quote=(alt.metadata or {}).get("source_quote") or "",
                    )
                    acknowledgment, question_text = _polish_turn(acknowledgment, question_text, max_questions=1)
                    break

    spoken = _compose_spoken(acknowledgment, question_text)
    return {
        "mode": mode,
        "planned_id": planned_id,
        "planned": planned,
        "question_text": spoken,
        "raw_question": question_text,
        "acknowledgment": acknowledgment,
        "bridge": acknowledgment,
        "rationale": data.get("rationale") or "",
        "rag_chunks": rag_chunks,
        "excerpt": excerpt,
        "answer_analysis": answer_analysis,
        "triggering_answer_id": last_answer_id,
        "parent_planned": (
            last_question.planned_question if mode == "follow_up" and last_question else None
        ),
    }
