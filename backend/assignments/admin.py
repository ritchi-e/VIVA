from django.contrib import admin

from assignments.models import Assignment, LearningOutcome


class LearningOutcomeInline(admin.TabularInline):
    model = LearningOutcome
    extra = 0


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "status", "due_at")
    list_filter = ("status",)
    inlines = [LearningOutcomeInline]


@admin.register(LearningOutcome)
class LearningOutcomeAdmin(admin.ModelAdmin):
    list_display = ("code", "assignment", "order")
