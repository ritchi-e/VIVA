import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("aiviva")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "start-due-viva-slots": {
        "task": "viva.tasks.start_due_viva_slots",
        "schedule": 60.0,
    },
    "mark-no-show-bookings": {
        "task": "viva.tasks.mark_no_show_bookings",
        "schedule": 120.0,
    },
}
