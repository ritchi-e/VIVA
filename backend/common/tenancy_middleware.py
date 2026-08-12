from django.utils.deprecation import MiddlewareMixin

from common.tenancy import resolve_tenant_context


class OrganizationTenantMiddleware(MiddlewareMixin):
    """Resolve X-Organization-ID for authenticated API requests."""

    def process_view(self, request, view_func, view_args, view_kwargs):
        if not request.path.startswith("/api/"):
            return None
        if request.path.startswith("/api/auth/") or request.path.startswith("/api/health/"):
            return None
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            try:
                resolve_tenant_context(request)
            except Exception:
                pass
        return None
