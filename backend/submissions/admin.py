from django.contrib import admin

from submissions.models import (
    CodeDependency,
    CodeSymbol,
    EmbeddingCache,
    QuestionCandidate,
    RepositoryFile,
    RepositorySnapshot,
    Submission,
    SubmissionChunk,
    SubmissionFile,
    SubmissionVersion,
)


class SubmissionFileInline(admin.TabularInline):
    model = SubmissionFile
    extra = 0


class RepositoryFileInline(admin.TabularInline):
    model = RepositoryFile
    extra = 0
    fields = ("path", "language", "category", "indexed", "skip_reason")
    readonly_fields = fields


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("assignment", "student", "status", "processing_stage", "version")
    list_filter = ("status", "processing_stage")
    inlines = [SubmissionFileInline]


@admin.register(SubmissionFile)
class SubmissionFileAdmin(admin.ModelAdmin):
    list_display = ("original_filename", "submission", "file_type")


@admin.register(SubmissionChunk)
class SubmissionChunkAdmin(admin.ModelAdmin):
    list_display = ("submission", "chunk_index", "source_ref", "token_count")


@admin.register(SubmissionVersion)
class SubmissionVersionAdmin(admin.ModelAdmin):
    list_display = ("submission", "version_number")


@admin.register(RepositorySnapshot)
class RepositorySnapshotAdmin(admin.ModelAdmin):
    list_display = ("owner", "repo", "commit_sha", "status", "files_indexed")
    inlines = [RepositoryFileInline]


@admin.register(RepositoryFile)
class RepositoryFileAdmin(admin.ModelAdmin):
    list_display = ("path", "snapshot", "category", "indexed")


@admin.register(CodeSymbol)
class CodeSymbolAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "repository_file", "start_line")


@admin.register(CodeDependency)
class CodeDependencyAdmin(admin.ModelAdmin):
    list_display = ("from_path", "to_path", "kind", "resolved")


@admin.register(QuestionCandidate)
class QuestionCandidateAdmin(admin.ModelAdmin):
    list_display = ("submission", "level", "question_type", "source_ref")


@admin.register(EmbeddingCache)
class EmbeddingCacheAdmin(admin.ModelAdmin):
    list_display = ("content_hash", "embedding_model", "created_at")
