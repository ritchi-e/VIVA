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


@shared_task(bind=True, max_retries=2, default_retry_delay=20)
def notify_integrity_termination_task(self, session_id: str, organization_id: str, reason: str):
    """Email assignment instructors that a viva was stopped for integrity."""
    from django.conf import settings
    from django.core.mail import send_mail

    from orgs.models import Membership, Organization
    from viva.models import VivaSession

    try:
        session = VivaSession.objects.select_related(
            "assignment", "assignment__created_by", "student", "assignment__course"
        ).get(pk=session_id)
        organization = Organization.objects.get(pk=organization_id)
    except (VivaSession.DoesNotExist, Organization.DoesNotExist):
        return {"status": "skipped", "reason": "missing", "session_id": session_id}

    recipients = set()
    created_by = session.assignment.created_by
    if created_by and created_by.email:
        recipients.add(created_by.email)
    instructor_emails = Membership.objects.filter(
        organization=organization,
        is_active=True,
        role__in=[Membership.Role.INSTRUCTOR, Membership.Role.ORGANIZATION_ADMIN],
    ).values_list("user__email", flat=True)
    recipients.update(email for email in instructor_emails if email)
    recipients.discard(session.student.email)
    if not recipients:
        return {"status": "skipped", "reason": "no_recipients", "session_id": session_id}

    reason_text = (
        "the student left the exam window for more than 5 seconds"
        if reason == "grace_expired"
        else f"an integrity event ({reason})"
    )
    body = (
        f"A viva was stopped for {session.student.full_name or session.student.email} "
        f"on assignment “{session.assignment.title}” because {reason_text}.\n\n"
        f"Session id: {session.id}\n"
        f"Review the session in the instructor dashboard for the monitoring report.\n"
    )
    try:
        send_mail(
            f"Viva stopped: {session.assignment.title}",
            body,
            getattr(settings, "DEFAULT_FROM_EMAIL", None),
            sorted(recipients),
            fail_silently=True,
        )
    except Exception as exc:
        logger.exception("Integrity email failed for session %s", session_id)
        raise self.retry(exc=exc) from exc
    return {"status": "ok", "session_id": session_id, "recipients": len(recipients)}

