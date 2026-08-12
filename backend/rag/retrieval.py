from __future__ import annotations

import math
import time
from typing import Any

from django.db.models import QuerySet

from rag.models import RetrievalLog
from submissions.models import SubmissionChunk


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


def retrieve_similar_chunks(
    submission_id,
    query_vector: list[float],
    *,
    organization_id=None,
    top_k: int = 8,
) -> list[dict[str, Any]]:
    start = time.monotonic()
    qs: QuerySet[SubmissionChunk] = SubmissionChunk.objects.filter(
        submission_id=submission_id,
        embedding__isnull=False,
    )
    if organization_id:
        qs = qs.filter(submission__assignment__course__organization_id=organization_id)
    scored = []
    for chunk in qs.iterator():
        vec = chunk.embedding
        if not isinstance(vec, list):
            continue
        score = _cosine_similarity(query_vector, vec)
        scored.append(
            {
                "chunk_id": str(chunk.id),
                "score": score,
                "content": chunk.content,
                "source_ref": chunk.source_ref,
                "chunk_index": chunk.chunk_index,
            }
        )
    scored.sort(key=lambda x: x["score"], reverse=True)
    results = scored[:top_k]
    RetrievalLog.objects.create(
        submission_id=submission_id,
        query="vector_query",
        results=results,
        filters={"organization_id": str(organization_id) if organization_id else None},
        latency_ms=int((time.monotonic() - start) * 1000),
    )
    return results
