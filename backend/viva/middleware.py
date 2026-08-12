from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from common.tenancy import resolve_tenant_context


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        headers = dict(scope.get("headers") or [])
        token = None
        auth_header = headers.get(b"authorization", b"").decode()
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        if not token:
            query = parse_qs(scope.get("query_string", b"").decode())
            token = (query.get("token") or [None])[0]
        user = AnonymousUser()
        if token:
            user = await self.get_user(token)
        scope["user"] = user
        org_header = headers.get(b"x-organization-id", b"").decode()
        if user.is_authenticated and org_header:
            await self.set_tenant(scope, user, org_header)
        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user(self, token):
        try:
            access = AccessToken(token)
            return User.objects.get(pk=access["user_id"])
        except Exception:
            return AnonymousUser()

    @database_sync_to_async
    def set_tenant(self, scope, user, org_header):
        class _Req:
            META = {"HTTP_X_ORGANIZATION_ID": org_header}
            user = user

        try:
            resolve_tenant_context(_Req())
            scope["organization_id"] = str(user.active_organization_id)
        except Exception:
            scope["organization_id"] = None
