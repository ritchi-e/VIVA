from __future__ import annotations

import logging

from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist

logger = logging.getLogger(__name__)


def _load_session_for_post_process(session_id: str):
    from viva.models import VivaSession

    qs = VivaSession.objects.select_related(
        "assignment__course__organization", "submission", "student"
    )
    try:
        return qs.get(pk=session_id)
    except VivaSession.DoesNotExist:
        session = VivaSession.all_objects.select_related(
            "assignment__course__organization", "submission", "student"
        ).filter(pk=session_id).first()
        if session is None:
            return None
        if session.is_deleted:
            logger.warning("Post-viva skipped: session %s was soft-deleted", session_id)
            return None
        return session


@shared_task(bind=True, max_retries=2, default_retry_delay=15)
def process_completed_viva_task(self, session_id: str, organization_id: str):
    """Run AI answer evaluation + assessment generation after the viva ends."""
    from orgs.models import Organization
    from viva.post_process import process_completed_viva

    session = _load_session_for_post_process(session_id)
    if session is None:
        logger.warning(
            "Post-viva skipped: session %s does not exist (stale Celery message?)",
            session_id,
        )
        return {"status": "skipped", "reason": "session_not_found", "session_id": session_id}

    try:
        organization = Organization.objects.get(pk=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "Post-viva skipped: organization %s does not exist for session %s",
            organization_id,
            session_id,
        )
        return {
            "status": "skipped",
            "reason": "organization_not_found",
            "session_id": session_id,
        }

    try:
        process_completed_viva(session, organization)
    except ObjectDoesNotExist as exc:
        logger.warning(
            "Post-viva skipped: related record missing for session %s (%s)",
            session_id,
            exc,
        )
        return {"status": "skipped", "reason": "related_not_found", "session_id": session_id}
    except Exception as exc:
        logger.exception("Post-viva processing failed for session %s", session_id)
        raise self.retry(exc=exc) from exc

    return {"status": "ok", "session_id": session_id}
