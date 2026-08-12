from __future__ import annotations

import uuid

from django.http import Http404
from rest_framework.exceptions import NotAuthenticated, PermissionDenied

from orgs.models import Membership

ORGANIZATION_HEADER = "HTTP_X_ORGANIZATION_ID"


def get_organization_id(request) -> uuid.UUID | None:
    raw = request.META.get(ORGANIZATION_HEADER) or request.headers.get("X-Organization-ID")
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except (ValueError, TypeError):
        raise PermissionDenied("Invalid X-Organization-ID header")


def resolve_tenant_context(request) -> uuid.UUID | None:
    """Validate membership and set active org/role on the user."""
    if not request.user or not request.user.is_authenticated:
        raise NotAuthenticated()

    org_id = get_organization_id(request)
    if org_id is None:
        request.user.active_organization_id = None
        request.user.active_role = None
        return None

    if request.user.is_superuser:
        request.user.active_organization_id = org_id
        request.user.active_role = "organization_admin"
        return org_id

    membership = (
        Membership.objects.filter(
            user=request.user,
            organization_id=org_id,
            is_active=True,
        )
        .select_related("organization")
        .first()
    )
    if not membership:
        raise PermissionDenied("You are not a member of this organization")

    request.user.active_organization_id = org_id
    request.user.active_role = membership.role
    return org_id


class TenantContextMixin:
    """Attach tenant context before DRF permission checks."""

    def initial(self, request, *args, **kwargs):
        resolve_tenant_context(request)
        super().initial(request, *args, **kwargs)

    def get_organization_id(self) -> uuid.UUID:
        org_id = self.request.user.active_organization_id
        if not org_id:
            org_id = resolve_tenant_context(self.request)
        if not org_id:
            raise PermissionDenied("X-Organization-ID header is required")
        return org_id


class TenantQuerysetMixin:
    """Filter querysets to the active organization."""

    organization_lookup = "organization_id"

    def get_organization_id(self) -> uuid.UUID:
        org_id = self.request.user.active_organization_id
        if not org_id:
            org_id = resolve_tenant_context(self.request)
        if not org_id:
            raise PermissionDenied("X-Organization-ID header is required")
        return org_id

    def filter_queryset_by_tenant(self, queryset):
        org_id = self.get_organization_id()
        lookup = getattr(self, "organization_lookup", "organization_id")
        return queryset.filter(**{lookup: org_id})
