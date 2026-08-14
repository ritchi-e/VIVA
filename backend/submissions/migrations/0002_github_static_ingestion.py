import uuid

from django.db import migrations, models
import django.db.models.deletion


def add_pgvector(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("CREATE EXTENSION IF NOT EXISTS vector")
    schema_editor.execute(
        "ALTER TABLE submissions_submissionchunk "
        "ADD COLUMN IF NOT EXISTS embedding_vec vector(1536)"
    )


def drop_pgvector(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("ALTER TABLE submissions_submissionchunk DROP COLUMN IF EXISTS embedding_vec")


class Migration(migrations.Migration):
    dependencies = [
        ("submissions", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="processing_stage",
            field=models.CharField(
                blank=True,
                choices=[
                    ("queued", "Queued"),
                    ("fetching_repository", "Fetching repository"),
                    ("indexing_files", "Indexing files"),
                    ("analyzing_structure", "Analyzing structure"),
                    ("embedding_evidence", "Embedding evidence"),
                    ("building_question_context", "Building question context"),
                    ("complete", "Complete"),
                    ("failed", "Failed"),
                ],
                default="queued",
                max_length=48,
            ),
        ),
        migrations.CreateModel(
            name="EmbeddingCache",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("content_hash", models.CharField(db_index=True, max_length=64)),
                ("embedding_model", models.CharField(max_length=128)),
                ("vector", models.JSONField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"unique_together": {("content_hash", "embedding_model")}},
        ),
        migrations.CreateModel(
            name="RepositorySnapshot",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("github_url", models.URLField()),
                ("owner", models.CharField(max_length=128)),
                ("repo", models.CharField(max_length=256)),
                ("default_branch", models.CharField(blank=True, max_length=256)),
                ("commit_sha", models.CharField(blank=True, db_index=True, max_length=64)),
                ("archive_storage_key", models.CharField(blank=True, max_length=1024)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("fetching", "Fetching"),
                            ("indexed", "Indexed"),
                            ("failed", "Failed"),
                        ],
                        default="pending",
                        max_length=32,
                    ),
                ),
                ("files_indexed", models.PositiveIntegerField(default=0)),
                ("files_skipped", models.PositiveIntegerField(default=0)),
                ("total_bytes", models.BigIntegerField(default=0)),
                ("extracted_chars", models.PositiveIntegerField(default=0)),
                ("project_profile", models.JSONField(blank=True, default=dict)),
                ("error_message", models.TextField(blank=True)),
                ("stage_timings", models.JSONField(blank=True, default=dict)),
                (
                    "submission",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="repository",
                        to="submissions.submission",
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="repositorysnapshot",
            index=models.Index(fields=["owner", "repo", "commit_sha"], name="submissions_owner_8c1a11_idx"),
        ),
        migrations.CreateModel(
            name="RepositoryFile",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("path", models.CharField(max_length=1024)),
                ("language", models.CharField(blank=True, max_length=32)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("source", "Source"),
                            ("documentation", "Documentation"),
                            ("configuration", "Configuration"),
                            ("test", "Test"),
                            ("generated", "Generated"),
                            ("binary", "Binary"),
                            ("dataset", "Dataset"),
                            ("unsupported", "Unsupported"),
                        ],
                        default="unsupported",
                        max_length=32,
                    ),
                ),
                ("size_bytes", models.BigIntegerField(default=0)),
                ("content_hash", models.CharField(blank=True, db_index=True, max_length=64)),
                ("indexed", models.BooleanField(default=False)),
                ("skip_reason", models.CharField(blank=True, max_length=128)),
                ("extracted_text", models.TextField(blank=True)),
                (
                    "snapshot",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="files",
                        to="submissions.repositorysnapshot",
                    ),
                ),
            ],
            options={"unique_together": {("snapshot", "path")}},
        ),
        migrations.AddIndex(
            model_name="repositoryfile",
            index=models.Index(fields=["snapshot", "indexed"], name="submissions_snapsho_9f2b01_idx"),
        ),
        migrations.CreateModel(
            name="CodeSymbol",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=256)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("function", "Function"),
                            ("class", "Class"),
                            ("method", "Method"),
                            ("import", "Import"),
                            ("route", "Route"),
                            ("model", "Model"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=32,
                    ),
                ),
                ("signature", models.CharField(blank=True, max_length=1024)),
                ("docstring", models.TextField(blank=True)),
                ("start_line", models.PositiveIntegerField(default=1)),
                ("end_line", models.PositiveIntegerField(default=1)),
                ("language", models.CharField(blank=True, max_length=32)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                (
                    "repository_file",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="symbols",
                        to="submissions.repositoryfile",
                    ),
                ),
                (
                    "snapshot",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="symbols",
                        to="submissions.repositorysnapshot",
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="codesymbol",
            index=models.Index(fields=["snapshot", "kind"], name="submissions_snapsho_a11c22_idx"),
        ),
        migrations.AddIndex(
            model_name="codesymbol",
            index=models.Index(fields=["repository_file", "start_line"], name="submissions_reposit_b22d33_idx"),
        ),
        migrations.CreateModel(
            name="CodeDependency",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("from_path", models.CharField(max_length=1024)),
                ("to_path", models.CharField(blank=True, max_length=1024)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("import", "Import"),
                            ("call", "Call"),
                            ("unresolved", "Unresolved"),
                        ],
                        default="import",
                        max_length=32,
                    ),
                ),
                ("resolved", models.BooleanField(default=False)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                (
                    "from_file",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="outbound_dependencies",
                        to="submissions.repositoryfile",
                    ),
                ),
                (
                    "from_symbol",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="outbound_edges",
                        to="submissions.codesymbol",
                    ),
                ),
                (
                    "snapshot",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dependencies",
                        to="submissions.repositorysnapshot",
                    ),
                ),
                (
                    "to_file",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="inbound_dependencies",
                        to="submissions.repositoryfile",
                    ),
                ),
                (
                    "to_symbol",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="inbound_edges",
                        to="submissions.codesymbol",
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="submissionchunk",
            name="chunk_kind",
            field=models.CharField(
                choices=[
                    ("function", "Function"),
                    ("class", "Class"),
                    ("method", "Method"),
                    ("document", "Document"),
                    ("config", "Config"),
                    ("fallback", "Fallback"),
                ],
                default="fallback",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="submissionchunk",
            name="content_hash",
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddField(
            model_name="submissionchunk",
            name="end_line",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="submissionchunk",
            name="language",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="submissionchunk",
            name="path",
            field=models.CharField(blank=True, max_length=1024),
        ),
        migrations.AddField(
            model_name="submissionchunk",
            name="repository_file",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="chunks",
                to="submissions.repositoryfile",
            ),
        ),
        migrations.AddField(
            model_name="submissionchunk",
            name="start_line",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="submissionchunk",
            name="symbol",
            field=models.CharField(blank=True, max_length=256),
        ),
        migrations.AddIndex(
            model_name="submissionchunk",
            index=models.Index(fields=["submission", "path"], name="submissions_submiss_c33e44_idx"),
        ),
        migrations.CreateModel(
            name="QuestionCandidate",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "level",
                    models.CharField(
                        choices=[
                            ("project", "Project"),
                            ("implementation", "Implementation"),
                            ("follow_up", "Follow-up seed"),
                        ],
                        default="implementation",
                        max_length=32,
                    ),
                ),
                ("question_type", models.CharField(blank=True, max_length=64)),
                ("prompt_hint", models.TextField()),
                ("evidence_chunk_ids", models.JSONField(blank=True, default=list)),
                ("source_ref", models.CharField(blank=True, max_length=512)),
                ("start_line", models.PositiveIntegerField(blank=True, null=True)),
                ("end_line", models.PositiveIntegerField(blank=True, null=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                (
                    "snapshot",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="question_candidates",
                        to="submissions.repositorysnapshot",
                    ),
                ),
                (
                    "submission",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="question_candidates",
                        to="submissions.submission",
                    ),
                ),
            ],
        ),
        migrations.RunPython(add_pgvector, drop_pgvector),
    ]
