from __future__ import annotations

import hashlib
import logging
import re
from typing import Iterable

from django.utils import timezone

from ai.service import AIService
from common.storage import download_bytes
from orgs.models import Organization
from rag.knowledge import build_knowledge_nodes
from submissions.adapters import get_adapter
from submissions.adapters.github_adapter import GithubAdapter
from submissions.models import Submission, SubmissionChunk, SubmissionFile

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 150


def _chunk_text(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
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


def extract_submission(submission: Submission) -> list[tuple[SubmissionFile | None, str, dict]]:
    extracted: list[tuple[SubmissionFile | None, str, dict]] = []
    github_adapter = GithubAdapter()
    if submission.github_url:
        doc = github_adapter.extract_from_url(submission.github_url)
        extracted.append((None, doc.text, doc.structure))
    for sf in submission.files.all():
        adapter = get_adapter(sf.file_type)
        if not adapter:
            logger.warning("No adapter for file type %s", sf.file_type)
            continue
        data = download_bytes(sf.storage_key)
        doc = adapter.extract(data, sf.original_filename)
        sf.extracted_text = doc.text[:500_000]
        sf.structure = doc.structure
        sf.checksum = hashlib.sha256(data).hexdigest()
        sf.save(update_fields=["extracted_text", "structure", "checksum", "updated_at"])
        extracted.append((sf, doc.text, doc.structure))
    return extracted


def chunk_and_embed(submission: Submission, extracted: Iterable[tuple[SubmissionFile | None, str, dict]], org: Organization):
    submission.chunks.all().delete()
    ai = AIService(organization=org, user=submission.student)
    chunk_index = 0
    all_chunks: list[SubmissionChunk] = []
    texts_for_embed: list[str] = []
    for sf, text, structure in extracted:
        for piece in _chunk_text(text):
            sc = SubmissionChunk(
                submission=submission,
                file=sf,
                chunk_index=chunk_index,
                content=piece,
                token_count=len(piece.split()),
                metadata={"structure": structure},
                source_ref=sf.original_filename if sf else submission.github_url,
            )
            all_chunks.append(sc)
            texts_for_embed.append(piece)
            chunk_index += 1
    if not all_chunks:
        return
    embed_result = ai.embed(texts_for_embed)
    for sc, vector in zip(all_chunks, embed_result.vectors):
        sc.embedding = vector
    SubmissionChunk.objects.bulk_create(all_chunks)


def run_submission_pipeline(submission_id: str) -> None:
    submission = Submission.objects.select_related(
        "assignment__course__organization", "student"
    ).get(pk=submission_id)
    org = submission.assignment.course.organization
    submission.status = Submission.Status.PROCESSING
    submission.processing_error = ""
    submission.save(update_fields=["status", "processing_error", "updated_at"])
    try:
        validate_submission(submission)
        extracted = extract_submission(submission)
        chunk_and_embed(submission, extracted, org)
        knowledge = build_knowledge_nodes(submission, org)
        submission.knowledge_representation = knowledge
        submission.status = Submission.Status.READY
        submission.processed_at = timezone.now()
        submission.save(
            update_fields=["knowledge_representation", "status", "processed_at", "updated_at"]
        )
    except Exception as exc:
        logger.exception("Submission pipeline failed for %s", submission_id)
        submission.status = Submission.Status.FAILED
        submission.processing_error = str(exc)
        submission.save(update_fields=["status", "processing_error", "updated_at"])
        raise
