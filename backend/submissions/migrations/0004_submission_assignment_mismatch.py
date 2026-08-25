from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0003_rename_submissions_snapsho_a11c22_idx_submissions_snapsho_9599ee_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="assignment_mismatch",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="submission",
            name="assignment_mismatch_reason",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="assignment_alignment_score",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
