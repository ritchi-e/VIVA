from __future__ import annotations

"""Per-submission plagiarism comparison (MVP).

Runs after each viva completes. See docs/plagiarism.md for the planned assignment-level
batch report (after instructor viva booking deadline, full cohort, one teacher report).
"""

import logging
from dataclasses import dataclass, field
from typing import Any

from django.conf import settings
from django.db import connection
from django.utils import timezone

from rag.retrieval import _cosine_similarity
from submissions.models import PlagiarismReport, RepositoryFile, Submission, SubmissionChunk

logger = logging.getLogger(__name__)


@dataclass
class _Fingerprints:
    upload_checksums: set[str] = field(default_factory=set)
    repo_hashes: set[str] = field(default_factory=set)
    chunk_hashes: set[str] = field(default_factory=set)
    repo_key: str | None = None
    chunk_count: int = 0


def _threshold(name: str, default: float) -> float:
    return float(getattr(settings, name, default))


def _fingerprints(submission: Submission) -> _Fingerprints:
    fp = _Fingerprints(
        upload_checksums=set(
            submission.files.exclude(checksum="").values_list("checksum", flat=True)
        ),
        chunk_hashes=set(
            submission.chunks.exclude(content_hash="").values_list("content_hash", flat=True)
        ),
        chunk_count=submission.chunks.count(),
    )
    try:
        snapshot = submission.repository
    except Exception:
        snapshot = None
    if snapshot and snapshot.commit_sha:
        fp.repo_key = f"{snapshot.owner}/{snapshot.repo}@{snapshot.commit_sha}"
        fp.repo_hashes = set(
            RepositoryFile.objects.filter(snapshot=snapshot, indexed=True)
            .exclude(content_hash="")
            .values_list("content_hash", flat=True)
        )
    return fp


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def _overlap_count(a: set[str], b: set[str]) -> int:
    return len(a & b)


def _embedding_similarity_ratio(submission_a: Submission, submission_b: Submission) -> tuple[float, int, list[dict[str, Any]]]:
    """Return (ratio, pair_count, sample_pairs) for chunks with high embedding similarity."""
    threshold = _threshold("PLAGIARISM_CHUNK_SIMILARITY_THRESHOLD", 0.88)
    max_samples = int(getattr(settings, "PLAGIARISM_MAX_SAMPLE_MATCHES", 5))
    max_chunks = int(getattr(settings, "PLAGIARISM_MAX_CHUNKS_COMPARE", 80))

    if connection.vendor == "postgresql":
        result = _pg_embedding_similarity(submission_a.id, submission_b.id, threshold, max_chunks, max_samples)
        if result is not None:
            return result

    chunks_a = list(
        SubmissionChunk.objects.filter(submission=submission_a, embedding__isnull=False).order_by("chunk_index")[
            :max_chunks
        ]
    )
    chunks_b = list(
        SubmissionChunk.objects.filter(submission=submission_b, embedding__isnull=False).order_by("chunk_index")[
            :max_chunks
        ]
    )
    if not chunks_a or not chunks_b:
        return 0.0, 0, []

    high_pairs = 0
    samples: list[dict[str, Any]] = []
    for left in chunks_a:
        vec_a = left.embedding
        if not isinstance(vec_a, list):
            continue
        best = 0.0
        best_chunk: SubmissionChunk | None = None
        for right in chunks_b:
            vec_b = right.embedding
            if not isinstance(vec_b, list):
                continue
            score = _cosine_similarity(vec_a, vec_b)
            if score > best:
                best = score
                best_chunk = right
        if best >= threshold:
            high_pairs += 1
            if len(samples) < max_samples and best_chunk:
                samples.append(
                    {
                        "path": left.path or left.source_ref or f"chunk-{left.chunk_index}",
                        "other_path": best_chunk.path or best_chunk.source_ref or f"chunk-{best_chunk.chunk_index}",
                        "kind": "similar_text",
                        "similarity": round(best, 3),
                    }
                )
    ratio = high_pairs / len(chunks_a) if chunks_a else 0.0
    return ratio, high_pairs, samples


def _pg_embedding_similarity(
    submission_a_id,
    submission_b_id,
    threshold: float,
    max_chunks: int,
    max_samples: int,
) -> tuple[float, int, list[dict[str, Any]]] | None:
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                WITH a AS (
                    SELECT id, path, source_ref, chunk_index, embedding_vec
                    FROM submissions_submissionchunk
                    WHERE submission_id = %s
                      AND is_deleted = false
                      AND embedding_vec IS NOT NULL
                    ORDER BY chunk_index
                    LIMIT %s
                ),
                pairs AS (
                    SELECT
                        a.id AS a_id,
                        a.path AS a_path,
                        a.source_ref AS a_ref,
                        a.chunk_index AS a_index,
                        MAX(1 - (a.embedding_vec <=> b.embedding_vec)) AS max_sim,
                        (
                            SELECT b2.path
                            FROM submissions_submissionchunk b2
                            WHERE b2.submission_id = %s
                              AND b2.is_deleted = false
                              AND b2.embedding_vec IS NOT NULL
                            ORDER BY a.embedding_vec <=> b2.embedding_vec
                            LIMIT 1
                        ) AS best_b_path,
                        (
                            SELECT b2.source_ref
                            FROM submissions_submissionchunk b2
                            WHERE b2.submission_id = %s
                              AND b2.is_deleted = false
                              AND b2.embedding_vec IS NOT NULL
                            ORDER BY a.embedding_vec <=> b2.embedding_vec
                            LIMIT 1
                        ) AS best_b_ref,
                        (
                            SELECT b2.chunk_index
                            FROM submissions_submissionchunk b2
                            WHERE b2.submission_id = %s
                              AND b2.is_deleted = false
                              AND b2.embedding_vec IS NOT NULL
                            ORDER BY a.embedding_vec <=> b2.embedding_vec
                            LIMIT 1
                        ) AS best_b_index
                    FROM a
                    INNER JOIN submissions_submissionchunk b
                        ON b.submission_id = %s
                       AND b.is_deleted = false
                       AND b.embedding_vec IS NOT NULL
                    GROUP BY a.id, a.path, a.source_ref, a.chunk_index, a.embedding_vec
                )
                SELECT
                    COUNT(*) FILTER (WHERE max_sim >= %s) AS high_pairs,
                    COUNT(*) AS total_a,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'path', COALESCE(NULLIF(a_path, ''), NULLIF(a_ref, ''), 'chunk-' || a_index::text),
                                'other_path', COALESCE(NULLIF(best_b_path, ''), NULLIF(best_b_ref, ''), 'chunk-' || best_b_index::text),
                                'kind', 'similar_text',
                                'similarity', ROUND(max_sim::numeric, 3)
                            )
                            ORDER BY max_sim DESC
                        ) FILTER (WHERE max_sim >= %s),
                        '[]'::json
                    ) AS samples
                FROM pairs
                """,
                [
                    str(submission_a_id),
                    max_chunks,
                    str(submission_b_id),
                    str(submission_b_id),
                    str(submission_b_id),
                    str(submission_b_id),
                    threshold,
                    threshold,
                ],
            )
            row = cursor.fetchone()
        if not row:
            return None
        high_pairs, total_a, samples_json = row
        total_a = total_a or 0
        high_pairs = high_pairs or 0
        ratio = (high_pairs / total_a) if total_a else 0.0
        samples = samples_json if isinstance(samples_json, list) else []
        return ratio, int(high_pairs), samples[:max_samples]
    except Exception:
        logger.debug("pgvector plagiarism comparison unavailable", exc_info=True)
        return None


def _compare_pair(submission: Submission, peer: Submission, fp_a: _Fingerprints, fp_b: _Fingerprints) -> dict[str, Any]:
    identical_repo = bool(fp_a.repo_key and fp_b.repo_key and fp_a.repo_key == fp_b.repo_key)
    upload_overlap = _overlap_count(fp_a.upload_checksums, fp_b.upload_checksums)
    repo_overlap = _overlap_count(fp_a.repo_hashes, fp_b.repo_hashes)
    chunk_hash_overlap = _overlap_count(fp_a.chunk_hashes, fp_b.chunk_hashes)

    upload_j = _jaccard(fp_a.upload_checksums, fp_b.upload_checksums)
    repo_j = _jaccard(fp_a.repo_hashes, fp_b.repo_hashes)
    chunk_j = _jaccard(fp_a.chunk_hashes, fp_b.chunk_hashes)

    embed_ratio, similar_pairs, embed_samples = _embedding_similarity_ratio(submission, peer)

    hash_score = max(upload_j, repo_j, chunk_j)
    detected_threshold = _threshold("PLAGIARISM_DETECTED_THRESHOLD", 0.25)
    high_threshold = _threshold("PLAGIARISM_HIGH_SIMILARITY_THRESHOLD", 0.45)
    min_matches = int(getattr(settings, "PLAGIARISM_MIN_EXACT_MATCHES", 3))
    exact_overlaps = repo_overlap + chunk_hash_overlap + upload_overlap

    # Embedding similarity only contributes when multiple chunks align — avoids false
    # positives from a single coincidentally similar vector pair.
    embed_score = embed_ratio if similar_pairs >= min_matches else 0.0
    combined = max(hash_score, embed_score)
    if identical_repo:
        combined = 1.0

    samples: list[dict[str, Any]] = list(embed_samples)
    if identical_repo and not samples:
        samples.append(
            {
                "path": fp_a.repo_key or "repository",
                "other_path": fp_b.repo_key or "repository",
                "kind": "identical_repository",
                "similarity": 1.0,
            }
        )
    if upload_overlap and len(samples) < 5:
        samples.append(
            {
                "path": "uploaded file",
                "other_path": "uploaded file",
                "kind": "exact_hash",
                "similarity": 1.0,
            }
        )

    flagged = (
        identical_repo
        or combined >= high_threshold
        or (hash_score >= detected_threshold and exact_overlaps >= min_matches)
        or (embed_ratio >= detected_threshold and similar_pairs >= min_matches)
    )

    return {
        "submission_id": str(peer.id),
        "student_id": str(peer.student_id),
        "student_name": peer.student.full_name or "",
        "student_email": peer.student.email,
        "similarity_score": round(combined, 3),
        "flagged": flagged,
        "identical_repository": identical_repo,
        "matching_upload_files": upload_overlap,
        "matching_repo_files": repo_overlap,
        "matching_chunks": chunk_hash_overlap,
        "similar_chunk_pairs": similar_pairs,
        "sample_matches": samples[:5],
    }


def _build_summary(submission: Submission, matches: list[dict[str, Any]], detected: bool) -> str:
    if not matches:
        return "No other submissions were available to compare."
    top = matches[0]
    if not detected:
        return (
            f"Compared against {len(matches)} other submission(s). "
            "No significant overlap was detected."
        )
    if top.get("identical_repository"):
        who = top.get("student_name") or top.get("student_email") or "another student"
        return f"Identical GitHub repository snapshot as {who}."
    who = top.get("student_name") or top.get("student_email") or "another student"
    pct = int(float(top.get("similarity_score", 0)) * 100)
    return (
        f"Significant similarity ({pct}%) with the submission from {who}. "
        "Review the matched files and text sections below."
    )


def generate_plagiarism_report(submission: Submission, viva_session=None) -> PlagiarismReport:
    """Compare a submission against peers on the same assignment after viva completion."""
    report, _created = PlagiarismReport.objects.get_or_create(submission=submission)
    report.viva_session = viva_session
    report.status = PlagiarismReport.Status.PENDING
    report.save(update_fields=["viva_session", "status", "updated_at"])

    peers = (
        Submission.objects.filter(
            assignment_id=submission.assignment_id,
            status=Submission.Status.READY,
            is_deleted=False,
        )
        .exclude(pk=submission.pk)
        .select_related("student", "repository")
        .prefetch_related("files", "chunks")
    )
    peer_list = list(peers)
    if not peer_list:
        report.status = PlagiarismReport.Status.SKIPPED
        report.checked_at = timezone.now()
        report.plagiarism_detected = False
        report.highest_similarity = 0.0
        report.peer_count = 0
        report.summary = "No other submissions were available to compare."
        report.matches = []
        report.save()
        return report

    fp_a = _fingerprints(submission)
    matches: list[dict[str, Any]] = []
    for peer in peer_list:
        fp_b = _fingerprints(peer)
        quick_overlap = (
            (fp_a.repo_key and fp_b.repo_key and fp_a.repo_key == fp_b.repo_key)
            or _overlap_count(fp_a.upload_checksums, fp_b.upload_checksums)
            or _overlap_count(fp_a.repo_hashes, fp_b.repo_hashes)
            or _overlap_count(fp_a.chunk_hashes, fp_b.chunk_hashes)
        )
        if not quick_overlap and fp_a.chunk_count and fp_b.chunk_count:
            # Still run embedding comparison for paraphrased copies.
            match = _compare_pair(submission, peer, fp_a, fp_b)
            if match["similarity_score"] >= _threshold("PLAGIARISM_EMBEDDING_MIN_SCORE", 0.15):
                matches.append(match)
            continue
        if quick_overlap or not (fp_a.chunk_count and fp_b.chunk_count):
            matches.append(_compare_pair(submission, peer, fp_a, fp_b))

    matches.sort(key=lambda item: item["similarity_score"], reverse=True)
    top_matches = [m for m in matches if m["similarity_score"] > 0][:10]
    highest = top_matches[0]["similarity_score"] if top_matches else 0.0
    detected = any(m.get("flagged") for m in top_matches)

    report.status = PlagiarismReport.Status.COMPLETE
    report.checked_at = timezone.now()
    report.plagiarism_detected = detected
    report.highest_similarity = highest
    report.peer_count = len(peer_list)
    report.matches = top_matches
    report.summary = _build_summary(submission, top_matches, detected)
    report.save()
    logger.info(
        "Plagiarism report submission=%s peers=%s detected=%s highest=%s",
        submission.id,
        len(peer_list),
        detected,
        highest,
    )
    return report
