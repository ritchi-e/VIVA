from django.contrib import admin

from assessments.models import Assessment, AssessmentCriterion, AssessmentEvidence, AssessmentModification


class AssessmentCriterionInline(admin.TabularInline):
    model = AssessmentCriterion
    extra = 0


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = ("viva_session", "status", "overall_score")
    list_filter = ("status",)
    inlines = [AssessmentCriterionInline]


@admin.register(AssessmentCriterion)
class AssessmentCriterionAdmin(admin.ModelAdmin):
    list_display = ("name", "assessment", "final_score")


@admin.register(AssessmentEvidence)
class AssessmentEvidenceAdmin(admin.ModelAdmin):
    list_display = ("criterion", "source_ref")


@admin.register(AssessmentModification)
class AssessmentModificationAdmin(admin.ModelAdmin):
    list_display = ("assessment", "field_name", "reviewer", "created_at")
