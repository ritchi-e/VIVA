from __future__ import annotations

from typing import Any

from audit.models import AuditLog


def log_audit(
    org,
    actor,
    action: str,
    resource_type: str,
    resource_id: str,
    request=None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    ip_address = None
    user_agent = ""
    if request is not None:
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            ip_address = xff.split(",")[0].strip()
        else:
            ip_address = request.META.get("REMOTE_ADDR")
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:2000]

    return AuditLog.objects.create(
        organization=org,
        actor=actor,
        action=action,
        resource_type=resource_type or "",
        resource_id=str(resource_id) if resource_id is not None else "",
        ip_address=ip_address,
        user_agent=user_agent,
        metadata=metadata or {},
    )
