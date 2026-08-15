from __future__ import annotations

import re
from typing import Any

_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_\-./]{1,63}")
_STOP = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "your",
    "file",
    "code",
    "function",
    "class",
    "method",
    "data",
    "main",
    "test",
    "submission",
    "student",
    "explain",
    "describe",
}


def tokenize(text: str) -> set[str]:
    return {
        t.lower()
        for t in re.findall(r"[A-Za-z0-9_./]+", text or "")
        if len(t) > 2 and t.lower() not in _STOP
    }


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = len(a | b)
    if not union:
        return 0.0
    return len(a & b) / union


def quote_in_corpus(quote: str, chunks: list[dict[str, Any]]) -> dict[str, Any] | None:
    needle = " ".join((quote or "").split()).strip().lower()
    if len(needle) < 8:
        return None
    for chunk in chunks:
        content = " ".join((chunk.get("content") or "").split()).lower()
        if needle[:48] in content or needle in content:
            return chunk
        if len(needle) >= 24 and needle[:24] in content:
            return chunk
    return None


def concept_chunk_overlap(concept: str, purpose: str, chunks: list[dict[str, Any]]) -> float:
    query = tokenize(f"{concept} {purpose}")
    if not query:
        return 0.0
    corpus: set[str] = set()
    for chunk in chunks:
        corpus |= tokenize(chunk.get("content") or "")
        corpus |= tokenize(str(chunk.get("source_ref") or ""))
    if not corpus:
        return 0.0
    return jaccard(query, corpus)


def _identifier_like(text: str) -> bool:
    if not text:
        return False
    if any(ch in text for ch in ("_", "/", ".")):
        return True
    tokens = _TOKEN_RE.findall(text)
    return any(t[:1].isupper() and len(t) > 2 for t in tokens)


def score_planned_question(
    *,
    concept: str,
    purpose: str,
    source_quote: str,
    chunks: list[dict[str, Any]],
    other_concepts: list[str] | None = None,
) -> dict[str, float]:
    """Heuristic 0–1 quality scores for a planned viva question."""
    matched = quote_in_corpus(source_quote, chunks)
    overlap = concept_chunk_overlap(concept, purpose, chunks)
    grounded = 0.0
    if matched:
        grounded = 0.85 + min(0.15, overlap)
    elif chunks and overlap >= 0.08:
        grounded = 0.55 + min(0.25, overlap)
    elif chunks:
        grounded = 0.25
    grounded = round(min(1.0, grounded), 3)

    specificity = 0.25
    if source_quote:
        specificity += 0.35
    if _identifier_like(f"{concept} {source_quote}"):
        specificity += 0.3
    if purpose and len(purpose.split()) >= 6:
        specificity += 0.1
    specificity = round(min(1.0, specificity), 3)

    novelty = 1.0
    concept_tokens = tokenize(concept)
    for other in other_concepts or []:
        novelty = min(novelty, 1.0 - jaccard(concept_tokens, tokenize(other)))
    novelty = round(max(0.0, novelty), 3)

    overall = round((0.5 * grounded) + (0.3 * specificity) + (0.2 * novelty), 3)
    return {
        "grounded": grounded,
        "specificity": specificity,
        "novelty": novelty,
        "overall": overall,
    }


def is_grounded_item(
    *,
    question_type: str,
    source_quote: str,
    source_chunk_id: str,
    chunks: list[dict[str, Any]],
    concept: str,
    purpose: str,
) -> tuple[bool, str]:
    """Return (ok, reason) for plan-time citation / overlap checks."""
    matched = quote_in_corpus(source_quote, chunks) if source_quote else None
    overlap = concept_chunk_overlap(concept, purpose, chunks)
    has_chunk = bool(source_chunk_id) or bool(chunks)
    if question_type == "implementation" and not matched and not source_chunk_id:
        return False, "missing_implementation_citation"
    if source_quote and not matched:
        return False, "invalid_quote"
    if not has_chunk:
        return False, "missing_chunk"
    if overlap < 0.04 and not matched:
        return False, "low_concept_overlap"
    return True, "valid"


def diversify_plan_items(items: list[dict[str, Any]], *, budget: int) -> list[dict[str, Any]]:
    """Drop near-duplicate concepts and repeated source chunks, keep up to budget."""
    selected: list[dict[str, Any]] = []
    used_chunks: set[str] = set()
    used_concepts: list[set[str]] = []

    def _too_similar(concept: str, chunk_id: str) -> bool:
        if chunk_id and chunk_id in used_chunks:
            return True
        tokens = tokenize(concept)
        return any(jaccard(tokens, prev) >= 0.6 for prev in used_concepts)

    grounded = [item for item in items if item.get("_grounded")]
    weak = [item for item in items if not item.get("_grounded")]

    for pool in (grounded, weak):
        for item in pool:
            if len(selected) >= budget:
                break
            concept = str(item.get("concept") or "")
            chunk_id = str(item.get("source_chunk_id") or "")
            if selected and _too_similar(concept, chunk_id):
                continue
            selected.append(item)
            if chunk_id:
                used_chunks.add(chunk_id)
            used_concepts.append(tokenize(concept))

    if len(selected) < min(budget, len(items)):
        for item in items:
            if item in selected:
                continue
            selected.append(item)
            if len(selected) >= budget:
                break
    return selected[:budget]
