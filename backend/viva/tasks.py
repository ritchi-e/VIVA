from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def start_due_viva_slots():
    """Find bookings whose slot_start <= now and status=booked, create + prepare VivaSession."""
    from django.db import transaction

    from viva.models import VivaSession, VivaSlotBooking

    now = timezone.now()

    with transaction.atomic():
        due = list(
            VivaSlotBooking.objects.select_for_update(skip_locked=True).filter(
                status=VivaSlotBooking.Status.BOOKED,
                slot_start__lte=now,
                is_deleted=False,
            )
        )

        for booking in due:
            session = VivaSession.objects.create(
                assignment=booking.assignment,
                submission=booking.submission,
                student=booking.student,
                state=VivaSession.State.CREATED,
                time_limit_seconds=settings.VIVA_SLOT_DURATION_MINUTES * 60,
            )
            booking.viva_session = session
            booking.status = VivaSlotBooking.Status.STARTED
            booking.save(update_fields=["viva_session", "status", "updated_at"])
            logger.info("Slot booking %s started -> session %s", booking.id, session.id)

    return {"started": len(due)}


@shared_task
def mark_no_show_bookings():
    """Mark bookings as no_show if slot_end passed and session never progressed."""
    from viva.models import VivaSession, VivaSlotBooking

    now = timezone.now()
    stale = VivaSlotBooking.objects.filter(
        status__in=[VivaSlotBooking.Status.BOOKED, VivaSlotBooking.Status.STARTED],
        slot_end__lt=now,
        is_deleted=False,
    )

    count = 0
    for booking in stale:
        session = booking.viva_session
        if session is None or session.state in (VivaSession.State.CREATED, VivaSession.State.PREPARING):
            booking.status = VivaSlotBooking.Status.NO_SHOW
            booking.save(update_fields=["status", "updated_at"])
            count += 1
        elif session.state in (VivaSession.State.COMPLETED, VivaSession.State.REVIEW_REQUIRED):
            booking.status = VivaSlotBooking.Status.COMPLETED
            booking.save(update_fields=["status", "updated_at"])

    return {"no_shows": count}


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

