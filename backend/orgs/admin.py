from django.contrib import admin

from orgs.models import Membership, Organization


class MembershipFromOrgInline(admin.TabularInline):
    model = Membership
    extra = 1
    fields = ("user", "role", "is_active")
    autocomplete_fields = ("user",)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "member_count", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = (MembershipFromOrgInline,)

    @admin.display(description="Members")
    def member_count(self, obj: Organization) -> int:
        return obj.memberships.count()


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user_email", "user_name", "organization", "role", "is_active", "created_at")
    list_filter = ("role", "is_active", "organization")
    search_fields = ("user__email", "user__full_name", "organization__name")
    autocomplete_fields = ("user", "organization")
    list_editable = ("role", "is_active")

    @admin.display(description="Email", ordering="user__email")
    def user_email(self, obj: Membership) -> str:
        return obj.user.email

    @admin.display(description="Name", ordering="user__full_name")
    def user_name(self, obj: Membership) -> str:
        return obj.user.full_name or "—"
