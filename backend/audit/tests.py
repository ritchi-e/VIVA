from django.test import TestCase

from accounts.models import User
from audit import actions
from audit.services import log_audit
from common.request_context import set_request_id
from orgs.models import Organization


class AuditTrailTests(TestCase):
    def test_log_audit_includes_request_id(self):
        org = Organization.objects.create(name="Audit Org", slug="audit-org")
        user = User.objects.create_user(email="audit@example.com", password="x")
        set_request_id("req-123")
        try:
            entry = log_audit(
                org,
                user,
                actions.EVIDENCE_FLAG_CREATED,
                "evidence_flag",
                "flag-1",
                metadata={"flag_type": "requires_review"},
            )
        finally:
            set_request_id(None)
        self.assertEqual(entry.metadata.get("request_id"), "req-123")
        self.assertEqual(entry.action, actions.EVIDENCE_FLAG_CREATED)
