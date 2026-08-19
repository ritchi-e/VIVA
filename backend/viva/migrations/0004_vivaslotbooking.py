import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("assignments", "0001_initial"),
        ("submissions", "0001_initial"),
        ("viva", "0003_rename_viva_vivain_session_evt_idx_viva_vivain_session_d871ad_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="VivaSlotBooking",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("slot_start", models.DateTimeField()),
                ("slot_end", models.DateTimeField()),
                ("status", models.CharField(
                    choices=[
                        ("booked", "Booked"),
                        ("started", "Started"),
                        ("completed", "Completed"),
                        ("cancelled", "Cancelled"),
                        ("no_show", "No-show"),
                    ],
                    default="booked",
                    max_length=16,
                )),
                ("student", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="slot_bookings",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("assignment", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="slot_bookings",
                    to="assignments.assignment",
                )),
                ("submission", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="slot_bookings",
                    to="submissions.submission",
                )),
                ("viva_session", models.OneToOneField(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="slot_booking",
                    to="viva.vivasession",
                )),
            ],
            options={
                "ordering": ["slot_start"],
            },
        ),
        migrations.AddIndex(
            model_name="vivaslotbooking",
            index=models.Index(fields=["slot_start", "status"], name="viva_vivasl_slot_st_idx"),
        ),
        migrations.AddConstraint(
            model_name="vivaslotbooking",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_deleted", False), ("status__in", ["booked", "started"])),
                fields=("student", "assignment"),
                name="unique_active_booking_per_student_assignment",
            ),
        ),
    ]
