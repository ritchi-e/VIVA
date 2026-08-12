from django.contrib import admin

from questions.models import PlannedQuestion, QuestionPlan


class PlannedQuestionInline(admin.TabularInline):
    model = PlannedQuestion
    extra = 0


@admin.register(QuestionPlan)
class QuestionPlanAdmin(admin.ModelAdmin):
    inlines = [PlannedQuestionInline]


@admin.register(PlannedQuestion)
class PlannedQuestionAdmin(admin.ModelAdmin):
    list_display = ("order", "question_type", "concept")
