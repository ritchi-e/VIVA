from __future__ import annotations

import hashlib
import logging
import re
import time
from typing import Iterable

from django.conf import settings
from django.utils import timezone

from ai.service import AIService
from common.storage import download_bytes
from orgs.models import Organization
from rag.knowledge import build_knowledge_nodes
from submissions.adapters import get_adapter
from submissions.alignment import assess_assignment_alignment
from submissions.metrics import EMBED_CACHE, INGESTION_FAILURES, INGESTION_STAGE_DURATION
from submissions.models import EmbeddingCache, Submission, SubmissionChunk, SubmissionFile
from submissions.repository.candidates import generate_question_candidates
from submissions.repository.ingest import create_repository_chunks, ingest_github_repository
from submissions.repository.limits import static_ingestion_enabled
from submissions.repository.urls import GithubUrlError, parse_github_url
from submissions.text_sanitize import sanitize_json, sanitize_text

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 150


def _chunk_text(text: str) -> list[str]:
    text = sanitize_text(re.sub(r"\s+", " ", text).strip())
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(len(text), start + CHUNK_SIZE)
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(0, end - CHUNK_OVERLAP)
    return chunks


def _detect_file_type(filename: str, content_type: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return SubmissionFile.FileType.PDF
    if lower.endswith(".docx"):
        return SubmissionFile.FileType.DOCX
    if lower.endswith(".pptx"):
        return SubmissionFile.FileType.PPTX
    if lower.endswith(".zip"):
        return SubmissionFile.FileType.ZIP
    if "pdf" in content_type:
        return SubmissionFile.FileType.PDF
    return SubmissionFile.FileType.OTHER


def _set_stage(submission: Submission, stage: str) -> None:
    submission.processing_stage = stage
    submission.save(update_fields=["processing_stage", "updated_at"])


def _user_facing_pipeline_error(exc: BaseException) -> str:
    raw = sanitize_text(str(exc))[:4000]
    lower = raw.lower()
    if "0x00" in lower or "contain nul" in lower:
        return (
            "This file could not be processed because it contains unreadable data. "
            "Try a different PDF export or a cleaner GitHub repo."
        )
    return raw


def validate_submission(submission: Submission) -> None:
    assignment = submission.assignment
    if not submission.files.exists() and not submission.github_url:
        raise ValueError("Submission must include at least one file or a GitHub URL")
    for sf in submission.files.all():
        if sf.file_type == SubmissionFile.FileType.PDF and not assignment.allow_pdf:
            raise ValueError("PDF uploads not allowed for this assignment")
        if sf.file_type == SubmissionFile.FileType.DOCX and not assignment.allow_docx:
            raise ValueError("DOCX uploads not allowed for this assignment")
        if sf.file_type == SubmissionFile.FileType.PPTX and not assignment.allow_pptx:
            raise ValueError("PPTX uploads not allowed for this assignment")
        if sf.file_type == SubmissionFile.FileType.ZIP and not assignment.allow_zip:
            raise ValueError("ZIP uploads not allowed for this assignment")
    if submission.github_url and not assignment.allow_github:
        raise ValueError("GitHub submissions not allowed for this assignment")
    if submission.github_url:
        parse_github_url(submission.github_url)


def extract_submission(submission: Submission) -> list[tuple[SubmissionFile | None, str, dict]]:
    extracted: list[tuple[SubmissionFile | None, str, dict]] = []
    if submission.github_url and not static_ingestion_enabled():
        from submissions.adapters.github_adapter import GithubAdapter

        doc = GithubAdapter().extract_from_url(submission.github_url)
        extracted.append((None, sanitize_text(doc.text), sanitize_json(doc.structure)))
    for sf in submission.files.all():
        adapter = get_adapter(sf.file_type)
        if not adapter:
            logger.warning("No adapter for file type %s", sf.file_type)
            continue
        try:
            data = download_bytes(sf.storage_key)
        except Exception as exc:
            logger.exception("Storage download failed for submission file %s", sf.id)
            raise ValueError("We could not load the uploaded file. Please try submitting again.") from exc
        if not data:
            raise ValueError("The uploaded file was empty. Please try submitting again.")
        try:
            doc = adapter.extract(data, sf.original_filename)
        except ValueError:
            raise
        except Exception as exc:
            logger.exception("Extract failed for %s (%s)", sf.original_filename, sf.file_type)
            kind = (sf.file_type or "file").upper()
            raise ValueError(f"This {kind} could not be processed. Try a different export or file.") from exc
        text = sanitize_text(doc.text[:500_000])
        structure = sanitize_json(doc.structure)
        sf.extracted_text = text
        sf.structure = structure
        sf.checksum = hashlib.sha256(data).hexdigest()
        sf.extractor_version = getattr(adapter, "extractor_version", "") or ""
        sf.save(update_fields=["extracted_text", "structure", "checksum", "extractor_version", "updated_at"])
        extracted.append((sf, text, structure))
    return extracted


def _append_chunk(
    chunks: list[SubmissionChunk],
    *,
    submission: Submission,
    sf: SubmissionFile | None,
    index: int,
    piece: str,
    source_ref: str,
    path: str,
    page_number: int | None = None,
    section_heading: str = "",
    slide_number: int | None = None,
    inner_path: str = "",
    start_offset: int | None = None,
    end_offset: int | None = None,
    structure: dict | None = None,
) -> int:
    digest = hashlib.sha256(piece.encode("utf-8")).hexdigest()
    chunks.append(
        SubmissionChunk(
            submission=submission,
            file=sf,
            chunk_index=index,
            content=piece,
            token_count=len(piece.split()),
            metadata=sanitize_json(
                {
                    "structure": structure or {},
                    "path": path,
                    "page_number": page_number,
                    "slide_number": slide_number,
                    "inner_path": inner_path,
                }
            ),
            source_ref=source_ref,
            path=path,
            content_hash=digest,
            chunk_kind=SubmissionChunk.ChunkKind.DOCUMENT if sf else SubmissionChunk.ChunkKind.FALLBACK,
            page_number=page_number,
            section_heading=section_heading or "",
            slide_number=slide_number,
            inner_path=inner_path or "",
            start_offset=start_offset,
            end_offset=end_offset,
        )
    )
    return index + 1


def _chunk_region(
    chunks: list[SubmissionChunk],
    *,
    submission: Submission,
    sf: SubmissionFile | None,
    index: int,
    text: str,
    source_ref: str,
    path: str,
    page_number: int | None = None,
    section_heading: str = "",
    slide_number: int | None = None,
    inner_path: str = "",
    structure: dict | None = None,
) -> int:
    clean = sanitize_text(re.sub(r"\s+", " ", text).strip())
    if not clean:
        return index
    start = 0
    while start < len(clean):
        end = min(len(clean), start + CHUNK_SIZE)
        piece = clean[start:end]
        index = _append_chunk(
            chunks,
            submission=submission,
            sf=sf,
            index=index,
            piece=piece,
            source_ref=source_ref,
            path=path,
            page_number=page_number,
            section_heading=section_heading,
            slide_number=slide_number,
            inner_path=inner_path,
            start_offset=start,
            end_offset=end,
            structure=structure,
        )
        if end >= len(clean):
            break
        start = max(0, end - CHUNK_OVERLAP)
    return index


def _file_chunks(submission: Submission, extracted: Iterable[tuple[SubmissionFile | None, str, dict]]) -> list[SubmissionChunk]:
    chunks: list[SubmissionChunk] = []
    index = 0
    for sf, text, structure in extracted:
        structure = structure or {}
        filename = sf.original_filename if sf else (submission.github_url or "")
        pages = structure.get("pages") if isinstance(structure.get("pages"), list) else None
        slides = structure.get("slides") if isinstance(structure.get("slides"), list) else None
        zip_files = structure.get("files") if isinstance(structure.get("files"), list) else None

        if pages:
            for page in pages:
                page_text = page.get("text") or ""
                page_number = page.get("page")
                source_ref = f"{filename}#page={page_number}" if page_number else filename
                index = _chunk_region(
                    chunks,
                    submission=submission,
                    sf=sf,
                    index=index,
                    text=page_text,
                    source_ref=source_ref,
                    path=filename,
                    page_number=page_number if isinstance(page_number, int) else None,
                    structure=structure,
                )
            continue

        if slides:
            for slide in slides:
                slide_number = slide.get("slide")
                slide_text = "\n".join(slide.get("texts") or [])
                source_ref = f"{filename}#slide={slide_number}" if slide_number else filename
                index = _chunk_region(
                    chunks,
                    submission=submission,
                    sf=sf,
                    index=index,
                    text=slide_text,
                    source_ref=source_ref,
                    path=filename,
                    slide_number=slide_number if isinstance(slide_number, int) else None,
                    structure=structure,
                )
            continue

        if zip_files and "--- " in (text or ""):
            # Prefer per-file regions from the merged ZIP text when available.
            parts = re.split(r"(?m)^--- (.+?) ---\n", text or "")
            # parts: ["", path1, content1, path2, content2, ...]
            if len(parts) > 1:
                for i in range(1, len(parts), 2):
                    inner_path = parts[i]
                    content = parts[i + 1] if i + 1 < len(parts) else ""
                    source_ref = f"{filename}:{inner_path}"
                    index = _chunk_region(
                        chunks,
                        submission=submission,
                        sf=sf,
                        index=index,
                        text=content,
                        source_ref=source_ref,
                        path=filename,
                        inner_path=inner_path,
                        structure=structure,
                    )
                continue

        paragraphs = structure.get("paragraphs") if isinstance(structure.get("paragraphs"), list) else None
        if paragraphs:
            # Group paragraphs into chunk-sized regions while preserving section_heading when present.
            buffer = ""
            heading = ""
            for para in paragraphs:
                para_text = str(para or "").strip()
                if not para_text:
                    continue
                if len(para_text) < 80 and para_text.isupper():
                    heading = para_text
                candidate = f"{buffer}\n\n{para_text}".strip() if buffer else para_text
                if len(candidate) > CHUNK_SIZE and buffer:
                    index = _chunk_region(
                        chunks,
                        submission=submission,
                        sf=sf,
                        index=index,
                        text=buffer,
                        source_ref=filename,
                        path=filename,
                        section_heading=heading,
                        structure=structure,
                    )
                    buffer = para_text
                else:
                    buffer = candidate
            if buffer:
                index = _chunk_region(
                    chunks,
                    submission=submission,
                    sf=sf,
                    index=index,
                    text=buffer,
                    source_ref=filename,
                    path=filename,
                    section_heading=heading,
                    structure=structure,
                )
            continue

        index = _chunk_region(
            chunks,
            submission=submission,
            sf=sf,
            index=index,
            text=text or "",
            source_ref=filename,
            path=filename,
            structure=structure,
        )
    return chunks


def chunk_and_embed(
    submission: Submission,
    extracted: Iterable[tuple[SubmissionFile | None, str, dict]],
    org: Organization,
    extra_chunks: list[SubmissionChunk] | None = None,
):
    submission.chunks.all().delete()
    all_chunks = _file_chunks(submission, extracted)
    start_index = len(all_chunks)
    if extra_chunks:
        for offset, chunk in enumerate(extra_chunks):
            chunk.chunk_index = start_index + offset
            all_chunks.append(chunk)
    if not all_chunks:
        return

    model_name = getattr(settings, "OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    hashes = [c.content_hash or hashlib.sha256(c.content.encode("utf-8")).hexdigest() for c in all_chunks]
    for chunk, digest in zip(all_chunks, hashes):
        chunk.content_hash = digest

    cached = {
        (row.content_hash, row.embedding_model): row.vector
        for row in EmbeddingCache.objects.filter(content_hash__in=hashes, embedding_model=model_name)
    }
    missing_idx = [i for i, digest in enumerate(hashes) if (digest, model_name) not in cached]
    EMBED_CACHE.labels(result="hit").inc(len(all_chunks) - len(missing_idx))
    EMBED_CACHE.labels(result="miss").inc(len(missing_idx))

    vectors: list[list[float] | None] = [cached.get((digest, model_name)) for digest in hashes]
    if missing_idx:
        ai = AIService(organization=org, user=submission.student)
        texts = [all_chunks[i].content for i in missing_idx]
        embed_result = ai.embed(texts)
        cache_rows = []
        for idx, vector in zip(missing_idx, embed_result.vectors):
            vectors[idx] = vector
            cache_rows.append(
                EmbeddingCache(content_hash=hashes[idx], embedding_model=model_name, vector=vector)
            )
        EmbeddingCache.objects.bulk_create(cache_rows, ignore_conflicts=True, batch_size=100)

    for chunk, vector in zip(all_chunks, vectors):
        chunk.embedding = vector
    SubmissionChunk.objects.bulk_create(all_chunks, batch_size=200)
    _sync_pgvector(submission)


def _sync_pgvector(submission: Submission) -> None:
    from django.db import connection

    if connection.vendor != "postgresql":
        return
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE submissions_submissionchunk
                SET embedding_vec = (
                    SELECT array_agg(value::float8 ORDER BY ordinality)::vector
                    FROM json_array_elements_text(embedding::json) WITH ORDINALITY
                )
                WHERE submission_id = %s AND embedding IS NOT NULL
                """,
                [str(submission.id)],
            )
    except Exception:
        logger.debug("pgvector sync skipped", exc_info=True)


def run_submission_pipeline(submission_id: str) -> None:
    submission = Submission.objects.select_related(
        "assignment__course__organization", "student"
    ).get(pk=submission_id)
    org = submission.assignment.course.organization
    submission.status = Submission.Status.PROCESSING
    submission.processing_error = ""
    submission.processing_stage = Submission.ProcessingStage.INDEXING_FILES
    submission.save(update_fields=["status", "processing_error", "processing_stage", "updated_at"])
    pipeline_started = time.monotonic()
    try:
        validate_submission(submission)
        extracted = extract_submission(submission)
        extra_chunks: list[SubmissionChunk] = []
        snapshot = None
        if submission.github_url and static_ingestion_enabled():
            snapshot = ingest_github_repository(submission)
            if snapshot:
                extra_chunks = create_repository_chunks(submission, snapshot, start_index=0)

        _set_stage(submission, Submission.ProcessingStage.EMBEDDING_EVIDENCE)
        embed_started = time.monotonic()
        chunk_and_embed(submission, extracted, org, extra_chunks=extra_chunks)
        INGESTION_STAGE_DURATION.labels(stage="embedding_evidence").observe(time.monotonic() - embed_started)

        _set_stage(submission, Submission.ProcessingStage.BUILDING_QUESTION_CONTEXT)
        ctx_started = time.monotonic()
        knowledge = build_knowledge_nodes(submission, org)
        if snapshot:
            generate_question_candidates(snapshot)
            submission.metadata = {
                **(submission.metadata or {}),
                "repository": {
                    "owner": snapshot.owner,
                    "repo": snapshot.repo,
                    "commit_sha": snapshot.commit_sha,
                    "files_indexed": snapshot.files_indexed,
                    "files_skipped": snapshot.files_skipped,
                    "stack": (snapshot.project_profile or {}).get("stack") or [],
                },
                "assessment_disclaimer": (
                    "This viva assesses the student's understanding of the submitted implementation. "
                    "It does not verify that the code executes correctly."
                ),
            }
        submission.knowledge_representation = sanitize_json(knowledge)
        assess_assignment_alignment(submission, extracted)
        submission.status = Submission.Status.READY
        submission.processing_stage = Submission.ProcessingStage.COMPLETE
        submission.processed_at = timezone.now()
        submission.save(
            update_fields=[
                "knowledge_representation",
                "metadata",
                "status",
                "processing_stage",
                "processed_at",
                "assignment_mismatch",
                "assignment_mismatch_reason",
                "assignment_alignment_score",
                "updated_at",
            ]
        )
        INGESTION_STAGE_DURATION.labels(stage="building_question_context").observe(time.monotonic() - ctx_started)
        INGESTION_STAGE_DURATION.labels(stage="pipeline").observe(time.monotonic() - pipeline_started)
    except Exception as exc:
        logger.exception("Submission pipeline failed for %s", submission_id)
        INGESTION_FAILURES.labels(reason=exc.__class__.__name__).inc()
        submission.status = Submission.Status.FAILED
        submission.processing_stage = Submission.ProcessingStage.FAILED
        submission.processing_error = _user_facing_pipeline_error(exc)
        submission.save(update_fields=["status", "processing_stage", "processing_error", "updated_at"])
        raise
