from __future__ import annotations

from celery import shared_task

from submissions.models import Submission
from submissions.pipeline import run_submission_pipeline


@shared_task(bind=True, max_retries=2, autoretry_for=(), queue="ingestion")
def process_submission_task(self, submission_id: str):
    submission = Submission.objects.filter(pk=submission_id).first()
    if (
        submission
        and submission.status == Submission.Status.READY
        and submission.processing_stage == Submission.ProcessingStage.COMPLETE
    ):
        return str(submission_id)
    try:
        run_submission_pipeline(submission_id)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)
