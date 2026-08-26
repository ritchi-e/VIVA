from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.utils.translation import gettext_lazy as _

from accounts.models import User
from courses.models import CourseEnrollment
from orgs.models import Membership

admin.site.site_header = "Mokhik administration"
admin.site.site_title = "Mokhik admin"
admin.site.index_title = "Users, organizations, and assessments"


class AdminUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ("email", "full_name")

    def save(self, commit=True):
        user = super().save(commit=False)
        user.username = user.email
        if commit:
            user.save()
        return user


class AdminUserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"
        exclude = ("username",)


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 1
    fields = ("organization", "role", "is_active")
    autocomplete_fields = ("organization",)


class CourseEnrollmentInline(admin.TabularInline):
    model = CourseEnrollment
    extra = 0
    fields = ("course", "role")
    autocomplete_fields = ("course",)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    form = AdminUserChangeForm
    add_form = AdminUserCreationForm
    ordering = ("email",)
    list_display = (
        "email",
        "full_name",
        "membership_summary",
        "is_active",
        "is_staff",
        "is_superuser",
        "email_verified",
        "date_joined",
        "last_login",
    )
    list_filter = ("is_staff", "is_superuser", "is_active", "email_verified", "memberships__role")
    search_fields = ("email", "full_name")
    readonly_fields = ("date_joined", "last_login", "id")
    inlines = (MembershipInline, CourseEnrollmentInline)
    filter_horizontal = ("groups", "user_permissions")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Profile"), {"fields": ("full_name", "avatar_url", "email_verified")}),
        (
            _("Django admin access"),
            {
                "fields": ("is_active", "is_staff", "is_superuser"),
                "description": "is_staff is required to sign in at /admin/. is_superuser can manage everything.",
            },
        ),
        (_("Permissions"), {"classes": ("collapse",), "fields": ("groups", "user_permissions")}),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
        (_("System"), {"classes": ("collapse",), "fields": ("id",)}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "full_name", "password1", "password2"),
            },
        ),
        (
            _("Django admin access"),
            {"fields": ("is_staff", "is_superuser", "is_active")},
        ),
    )

    def save_model(self, request, obj, form, change):
        obj.username = obj.email
        super().save_model(request, obj, form, change)

    @admin.display(description="Organizations")
    def membership_summary(self, obj: User) -> str:
        rows = obj.memberships.select_related("organization").all()[:4]
        if not rows:
            return "—"
        return ", ".join(f"{m.organization.name} ({m.role})" for m in rows)
