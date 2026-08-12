from django.contrib import admin

from submissions.models import Submission, SubmissionChunk, SubmissionFile, SubmissionVersion


class SubmissionFileInline(admin.TabularInline):
    model = SubmissionFile
    extra = 0


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("assignment", "student", "status", "version")
    list_filter = ("status",)
    inlines = [SubmissionFileInline]


@admin.register(SubmissionFile)
class SubmissionFileAdmin(admin.ModelAdmin):
    list_display = ("original_filename", "submission", "file_type")


@admin.register(SubmissionChunk)
class SubmissionChunkAdmin(admin.ModelAdmin):
    list_display = ("submission", "chunk_index", "token_count")


@admin.register(SubmissionVersion)
class SubmissionVersionAdmin(admin.ModelAdmin):
    list_display = ("submission", "version_number")
