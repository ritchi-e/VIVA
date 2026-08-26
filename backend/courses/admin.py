from django.contrib import admin

from courses.models import Course, CourseEnrollment


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "organization", "term", "is_active")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "title")


@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("course", "user", "role")
    search_fields = ("user__email", "user__full_name", "course__code", "course__title")
    autocomplete_fields = ("course", "user")
