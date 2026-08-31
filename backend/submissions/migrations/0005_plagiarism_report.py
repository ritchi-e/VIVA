import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("viva", "0004_vivaslotbooking"),
        ("submissions", "0004_submission_assignment_mismatch"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlagiarismReport",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("complete", "Complete"), ("skipped", "Skipped")],
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("checked_at", models.DateTimeField(blank=True, null=True)),
                ("plagiarism_detected", models.BooleanField(default=False)),
                ("highest_similarity", models.FloatField(default=0.0)),
                ("peer_count", models.PositiveIntegerField(default=0)),
                ("summary", models.TextField(blank=True)),
                ("matches", models.JSONField(blank=True, default=list)),
                (
                    "submission",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="plagiarism_report",
                        to="submissions.submission",
                    ),
                ),
                (
                    "viva_session",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="plagiarism_reports",
                        to="viva.vivasession",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["plagiarism_detected", "checked_at"], name="submissions_plagia_0d4f21_idx")
                ],
            },
        ),
    ]
