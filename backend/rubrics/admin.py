from django.contrib import admin

from rubrics.models import Rubric, RubricCriterion


class RubricCriterionInline(admin.TabularInline):
    model = RubricCriterion
    extra = 0


@admin.register(Rubric)
class RubricAdmin(admin.ModelAdmin):
    inlines = [RubricCriterionInline]


@admin.register(RubricCriterion)
class RubricCriterionAdmin(admin.ModelAdmin):
    list_display = ("name", "rubric", "max_score", "order")
