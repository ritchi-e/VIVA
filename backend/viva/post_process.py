from __future__ import annotations

import logging

from assessments.engine import generate_assessment_for_session
from orgs.models import Organization
from viva.evaluation import evaluate_session_answers
from viva.models import VivaSession

logger = logging.getLogger(__name__)


def process_completed_viva(session: VivaSession, organization: Organization) -> None:
    """Evaluate all answers then generate the instructor-facing assessment draft."""
    evaluations = evaluate_session_answers(session, organization)
    scores = [ev.overall for ev in evaluations]
    understanding = dict(session.understanding_state or {})
    understanding["scores"] = scores
    understanding["average"] = (sum(scores) / len(scores)) if scores else 0
    understanding["evaluated_after_viva"] = True
    session.understanding_state = understanding
    session.save(update_fields=["understanding_state", "updated_at"])

    # If average is weak, mark for review when still in COMPLETED.
    if scores and understanding["average"] < 5.0 and session.state == VivaSession.State.COMPLETED:
        session.state = VivaSession.State.REVIEW_REQUIRED
        session.save(update_fields=["state", "updated_at"])

    generate_assessment_for_session(session, organization)
    try:
        from submissions.plagiarism import generate_plagiarism_report

        generate_plagiarism_report(session.submission, viva_session=session)
    except Exception:
        logger.exception("Plagiarism report failed for session=%s", session.id)
    logger.info(
        "Post-viva processing complete session=%s answers=%s avg=%s",
        session.id,
        len(evaluations),
        understanding.get("average"),
    )
