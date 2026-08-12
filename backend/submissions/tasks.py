from __future__ import annotations

from celery import shared_task

from submissions.pipeline import run_submission_pipeline


@shared_task(bind=True, max_retries=2)
def process_submission_task(self, submission_id: str):
    try:
        run_submission_pipeline(submission_id)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)
