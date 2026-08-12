from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOrganizationMember(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class HasOrgRole(BasePermission):
    allowed_roles = ()

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = getattr(request.user, "active_role", None)
        if request.user.is_superuser:
            return True
        return role in self.allowed_roles


class IsInstructorOrAdmin(HasOrgRole):
    allowed_roles = ("organization_admin", "instructor")


class IsOrgAdmin(HasOrgRole):
    allowed_roles = ("organization_admin",)


class IsStudent(HasOrgRole):
    allowed_roles = ("student",)


class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
