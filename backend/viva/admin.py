from django.contrib import admin

from viva.models import AnswerEvaluation, QuestionAttempt, StudentAnswer, VivaQuestion, VivaSession


class VivaQuestionInline(admin.TabularInline):
    model = VivaQuestion
    extra = 0


@admin.register(VivaSession)
class VivaSessionAdmin(admin.ModelAdmin):
    list_display = ("student", "assignment", "state", "questions_asked")
    list_filter = ("state",)
    inlines = [VivaQuestionInline]


@admin.register(VivaQuestion)
class VivaQuestionAdmin(admin.ModelAdmin):
    list_display = ("session", "sequence", "question_type")


@admin.register(QuestionAttempt)
class QuestionAttemptAdmin(admin.ModelAdmin):
    list_display = ("question", "attempt_number")


@admin.register(StudentAnswer)
class StudentAnswerAdmin(admin.ModelAdmin):
    list_display = ("attempt", "submitted_at")


@admin.register(AnswerEvaluation)
class AnswerEvaluationAdmin(admin.ModelAdmin):
    list_display = ("answer", "overall", "requires_follow_up")
