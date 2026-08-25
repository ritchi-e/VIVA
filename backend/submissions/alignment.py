from __future__ import annotations

import logging
from typing import Iterable

from ai.service import AIService
from submissions.models import Submission, SubmissionFile

logger = logging.getLogger(__name__)

MISMATCH_ALIGNMENT_THRESHOLD = 0.10

ALIGNMENT_SCHEMA = {
    "title": "assignment_alignment",
    "type": "object",
    "required": ["alignment_score", "related"],
    "properties": {
        "related": {"type": "boolean"},
        "alignment_score": {"type": "number"},
        "reason": {"type": "string"},
    },
}


def _assignment_brief(submission: Submission) -> str:
    assignment = submission.assignment
    parts = [
        assignment.title or "",
        assignment.description or "",
        assignment.instructions or "",
    ]
    return "\n".join(part.strip() for part in parts if part and part.strip())


def _submission_brief(
    submission: Submission,
    extracted: Iterable[tuple[SubmissionFile | None, str, dict]] | None = None,
) -> str:
    parts: list[str] = []
    if submission.github_url:
        parts.append(f"GitHub URL: {submission.github_url}")
    if extracted:
        for sf, text, _structure in extracted:
            label = sf.original_filename if sf else "extracted"
            snippet = (text or "").strip()
            if snippet:
                parts.append(f"## {label}\n{snippet[:8000]}")
    else:
        for sf in submission.files.all():
            snippet = (sf.extracted_text or "").strip()
            if snippet:
                parts.append(f"## {sf.original_filename}\n{snippet[:8000]}")
        for chunk in submission.chunks.order_by("chunk_index")[:12]:
            snippet = (chunk.content or "").strip()
            if snippet:
                parts.append(f"## {chunk.source_ref or chunk.path}\n{snippet[:2000]}")
    return "\n\n".join(parts)[:20000]


def assess_assignment_alignment(
    submission: Submission,
    extracted: Iterable[tuple[SubmissionFile | None, str, dict]] | None = None,
) -> None:
    """Flag submissions that are clearly about a different topic than the assignment.

    Only flags when estimated alignment is at most 10% (i.e. ~90% mismatch).
    Failures here never fail the pipeline or block the viva.
    """
    assignment_text = _assignment_brief(submission)
    submission_text = _submission_brief(submission, extracted)
    if not assignment_text.strip() or not submission_text.strip():
        return

    org = submission.assignment.course.organization
    ai = AIService(organization=org, user=submission.student)
    try:
        result = ai.structured(
            [
                {
                    "role": "system",
                    "content": (
                        "You compare an assignment brief with a student submission. "
                        "Decide whether the submission is about the same subject as the assignment. "
                        "alignment_score is 0 to 1 (1 = fully on-topic). "
                        "Set related=false only when the submission is clearly a different project or domain. "
                        "Generic assignment titles must not cause a mismatch by themselves. "
                        "Do not flag missing depth, poor quality, or incomplete work. "
                        "Return JSON only."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"<assignment>\n{assignment_text}\n</assignment>\n\n"
                        f"<submission>\n{submission_text}\n</submission>"
                    ),
                },
            ],
            ALIGNMENT_SCHEMA,
        )
        data = result.data if isinstance(result.data, dict) else {}
    except Exception:
        logger.exception("Assignment alignment check failed for submission %s", submission.id)
        return

    try:
        score = float(data.get("alignment_score", 1.0))
    except (TypeError, ValueError):
        score = 1.0
    score = max(0.0, min(1.0, score))
    related = bool(data.get("related", True))
    reason = str(data.get("reason") or "").strip()
    mismatched = (not related) and score <= MISMATCH_ALIGNMENT_THRESHOLD

    submission.assignment_mismatch = mismatched
    submission.assignment_alignment_score = score
    submission.assignment_mismatch_reason = (
        reason
        if mismatched
        else ""
    )
    if mismatched and not submission.assignment_mismatch_reason:
        submission.assignment_mismatch_reason = (
            "This submission appears to be about a different topic than the assignment."
        )
