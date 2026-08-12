from django.db.models import Count, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ai.models import AIRequest
from common.permissions import IsOrgAdmin
from common.tenancy import TenantContextMixin


class AIUsageMetricsView(TenantContextMixin, APIView):
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def get(self, request):
        org_id = self.get_organization_id()
        qs = AIRequest.objects.filter(organization_id=org_id)
        agg = qs.aggregate(
            total_requests=Count("id"),
            total_input_tokens=Sum("input_tokens"),
            total_output_tokens=Sum("output_tokens"),
            total_cost=Sum("estimated_cost_usd"),
        )
        by_type = list(
            qs.values("request_type")
            .annotate(count=Count("id"), input_tokens=Sum("input_tokens"), output_tokens=Sum("output_tokens"))
            .order_by("-count")
        )
        return Response(
            {
                "organization_id": str(org_id),
                "totals": {
                    "requests": agg["total_requests"] or 0,
                    "input_tokens": agg["total_input_tokens"] or 0,
                    "output_tokens": agg["total_output_tokens"] or 0,
                    "estimated_cost_usd": str(agg["total_cost"] or 0),
                },
                "by_request_type": by_type,
            }
        )
