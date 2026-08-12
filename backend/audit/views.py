from rest_framework import viewsets

from rest_framework.permissions import IsAuthenticated

from audit.models import AuditLog
from audit.serializers import AuditLogSerializer
from common.permissions import IsOrgAdmin
from common.tenancy import TenantContextMixin, TenantQuerysetMixin


class AuditLogViewSet(TenantContextMixin, TenantQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsOrgAdmin]
    serializer_class = AuditLogSerializer
    organization_lookup = "organization_id"
    filterset_fields = ("action", "resource_type", "actor")

    def get_queryset(self):
        return self.filter_queryset_by_tenant(AuditLog.objects.select_related("actor", "organization"))
