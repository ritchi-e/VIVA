from __future__ import annotations

import json
from typing import Any

from ai.service import AIService
from orgs.models import Organization
from rag.retrieval import retrieve_similar_chunks
from submissions.models import Submission, SubmissionChunk


def _fallback_chunks(submission: Submission, top_k: int) -> list[dict[str, Any]]:
    return [
        {
            "chunk_id": str(chunk.id),
            "score": 1.0,
            "content": chunk.content,
            "source_ref": chunk.source_ref or "",
            "chunk_index": chunk.chunk_index,
        }
        for chunk in SubmissionChunk.objects.filter(submission=submission).order_by("chunk_index")[:top_k]
    ]


def retrieve_for_submission(
    submission: Submission,
    organization: Organization,
    query: str,
    *,
    top_k: int = 8,
) -> list[dict[str, Any]]:
    """Embed *query* and retrieve the most relevant submission chunks."""
    total = SubmissionChunk.objects.filter(submission=submission).count()
    if total == 0:
        return []
    # Small submissions: send full coverage instead of title-biased similarity search.
    if total <= top_k:
        return _fallback_chunks(submission, total)

    embedded = SubmissionChunk.objects.filter(submission=submission, embedding__isnull=False).exists()
    if not embedded:
        return _fallback_chunks(submission, top_k)

    ai = AIService(organization=organization, user=submission.student)
    vector = ai.embed([query]).vectors[0]
    return retrieve_similar_chunks(
        submission.id,
        vector,
        organization_id=organization.id,
        top_k=top_k,
        query_text=query,
    )


def format_chunks_for_conversation(chunks: list[dict[str, Any]], *, max_chars: int = 12000) -> str:
    """Format chunks for live viva turns — source_ref labels only, no excerpt numbers."""
    if not chunks:
        return "No submission excerpts available."
    lines: list[str] = []
    used = 0
    for chunk in chunks:
        ref = (chunk.get("source_ref") or "submission").strip()
        body = (chunk.get("content") or "").strip()
        block = f"[{ref}]\n{body}\n"
        if used + len(block) > max_chars:
            remaining = max_chars - used
            if remaining > 200:
                lines.append(block[:remaining])
            break
        lines.append(block)
        used += len(block)
    return "\n".join(lines)


def format_chunks_for_prompt(chunks: list[dict[str, Any]], *, max_chars: int = 12000) -> str:
    if not chunks:
        return "No submission excerpts available."
    lines: list[str] = []
    used = 0
    for index, chunk in enumerate(chunks, start=1):
        header = (
            f"[Excerpt {index} | id={chunk.get('chunk_id', '?')} | "
            f"ref={chunk.get('source_ref', '?')} | relevance={chunk.get('score', 0):.3f}]"
        )
        body = (chunk.get("content") or "").strip()
        block = f"{header}\n{body}\n"
        if used + len(block) > max_chars:
            remaining = max_chars - used
            if remaining > 200:
                lines.append(block[:remaining])
            break
        lines.append(block)
        used += len(block)
    return "\n".join(lines)


def _knowledge_dict(submission: Submission) -> dict[str, Any]:
    from ai.providers.mock import normalize_structured_data

    knowledge = submission.knowledge_representation or {}
    if not isinstance(knowledge, dict):
        return {}
    return normalize_structured_data(knowledge)


def build_planning_query(submission: Submission) -> str:
    """Build an embedding query biased toward the student's work, not just the topic."""
    assignment = submission.assignment
    parts: list[str] = []

    # Seed with real submission text so similarity search is content-grounded.
    chunk_texts = list(
        SubmissionChunk.objects.filter(submission=submission)
        .order_by("chunk_index")
        .values_list("content", flat=True)[:4]
    )
    parts.extend(chunk_texts)
    if not chunk_texts:
        for sf in submission.files.all()[:2]:
            if sf.extracted_text:
                parts.append(sf.extracted_text[:2500])

    knowledge = _knowledge_dict(submission)
    for key in ("problem", "objectives", "methodology", "implementation", "results", "claims", "terms"):
        value = knowledge.get(key)
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, list):
            parts.extend(str(item) for item in value[:8])
        elif isinstance(value, dict):
            parts.append(json.dumps(value)[:800])

    # Assignment metadata last and lightly — it should not dominate retrieval.
    if assignment.title:
        parts.append(assignment.title)
    return " ".join(p for p in parts if p).strip()[:6000] or assignment.title


def build_concept_query(concept: str, purpose: str = "", question_type: str = "", source_quote: str = "") -> str:
    return " ".join(
        part for part in (source_quote, concept, purpose, question_type) if part
    ).strip()


def knowledge_summary_text(submission: Submission) -> str:
    knowledge = _knowledge_dict(submission)
    if not knowledge:
        return "No structured knowledge summary available."
    return json.dumps(knowledge, indent=2)[:6000]
