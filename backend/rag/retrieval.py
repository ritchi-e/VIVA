from __future__ import annotations

import math
import time
from typing import Any

from django.db import connection
from django.db.models import Q, QuerySet

from rag.models import RetrievalLog
from submissions.metrics import RETRIEVAL_LATENCY
from submissions.models import SubmissionChunk


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


def _lexical_score(chunk: SubmissionChunk, query: str) -> float:
    q = (query or "").lower()
    if not q:
        return 0.0
    hay = " ".join(
        [
            chunk.content or "",
            chunk.path or "",
            chunk.symbol or "",
            chunk.source_ref or "",
        ]
    ).lower()
    score = 0.0
    for token in [t for t in q.replace("/", " ").replace(".", " ").split() if len(t) > 2][:24]:
        if token in hay:
            score += 1.0
        if chunk.symbol and token == chunk.symbol.lower():
            score += 3.0
        if chunk.path and token in chunk.path.lower():
            score += 1.5
    return score


def _pgvector_search(submission_id, query_vector: list[float], organization_id, top_k: int) -> list[dict[str, Any]] | None:
    if connection.vendor != "postgresql" or not query_vector:
        return None
    try:
        vec_literal = "[" + ",".join(str(float(x)) for x in query_vector) + "]"
        sql = """
            SELECT c.id::text, 1 - (c.embedding_vec <=> %s::vector) AS score,
                   c.content, c.source_ref, c.chunk_index, c.path, c.symbol, c.start_line, c.end_line, c.language
            FROM submissions_submissionchunk c
            INNER JOIN submissions_submission s ON s.id = c.submission_id
            INNER JOIN assignments_assignment a ON a.id = s.assignment_id
            INNER JOIN courses_course co ON co.id = a.course_id
            WHERE c.submission_id = %s
              AND c.is_deleted = false
              AND c.embedding_vec IS NOT NULL
        """
        params: list[Any] = [vec_literal, str(submission_id)]
        if organization_id:
            sql += " AND co.organization_id = %s"
            params.append(str(organization_id))
        sql += " ORDER BY c.embedding_vec <=> %s::vector LIMIT %s"
        params.extend([vec_literal, top_k * 3])
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        return [
            {
                "chunk_id": row[0],
                "score": float(row[1] or 0),
                "content": row[2],
                "source_ref": row[3],
                "chunk_index": row[4],
                "path": row[5],
                "symbol": row[6],
                "start_line": row[7],
                "end_line": row[8],
                "language": row[9],
            }
            for row in rows
        ]
    except Exception:
        return None


def retrieve_similar_chunks(
    submission_id,
    query_vector: list[float],
    *,
    organization_id=None,
    top_k: int = 8,
    query_text: str = "",
) -> list[dict[str, Any]]:
    start = time.monotonic()
    pg_hits = _pgvector_search(submission_id, query_vector, organization_id, top_k)
    qs: QuerySet[SubmissionChunk] = SubmissionChunk.objects.filter(
        submission_id=submission_id,
        embedding__isnull=False,
    )
    if organization_id:
        qs = qs.filter(submission__assignment__course__organization_id=organization_id)
    if query_text:
        tokens = [t for t in query_text.replace("/", " ").split() if len(t) > 2][:8]
        lexical_q = Q()
        for token in tokens:
            lexical_q |= Q(content__icontains=token) | Q(path__icontains=token) | Q(symbol__icontains=token)
        if tokens:
            qs = qs.filter(lexical_q) | SubmissionChunk.objects.filter(submission_id=submission_id, embedding__isnull=False)

    scored: dict[str, dict[str, Any]] = {}
    if pg_hits is not None:
        for item in pg_hits:
            scored[item["chunk_id"]] = item
    else:
        for chunk in qs.iterator():
            vec = chunk.embedding
            if not isinstance(vec, list):
                continue
            score = _cosine_similarity(query_vector, vec)
            scored[str(chunk.id)] = {
                "chunk_id": str(chunk.id),
                "score": score,
                "content": chunk.content,
                "source_ref": chunk.source_ref,
                "chunk_index": chunk.chunk_index,
                "path": chunk.path,
                "symbol": chunk.symbol,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "language": chunk.language,
            }

    # Hybrid: blend lexical/path boosts and diversify by file
    if query_text:
        chunk_map = {str(c.id): c for c in SubmissionChunk.objects.filter(pk__in=list(scored.keys()))}
        for cid, item in scored.items():
            chunk = chunk_map.get(cid)
            if chunk:
                item["score"] = float(item["score"]) + 0.08 * _lexical_score(chunk, query_text)

    ranked = sorted(scored.values(), key=lambda x: x["score"], reverse=True)
    diversified: list[dict[str, Any]] = []
    seen_paths: set[str] = set()
    for item in ranked:
        path = item.get("path") or item.get("source_ref") or ""
        if path in seen_paths and len(diversified) < top_k:
            continue
        diversified.append(item)
        if path:
            seen_paths.add(path)
        if len(diversified) >= top_k:
            break
    if len(diversified) < top_k:
        for item in ranked:
            if item in diversified:
                continue
            diversified.append(item)
            if len(diversified) >= top_k:
                break

    results = diversified[:top_k]
    RETRIEVAL_LATENCY.observe(time.monotonic() - start)
    RetrievalLog.objects.create(
        submission_id=submission_id,
        query=query_text or "vector_query",
        results=results,
        filters={"organization_id": str(organization_id) if organization_id else None, "hybrid": True},
        latency_ms=int((time.monotonic() - start) * 1000),
    )
    return results
