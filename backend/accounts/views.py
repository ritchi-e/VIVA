from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from accounts.serializers import (
    LoginSerializer,
    MembershipSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)
from audit.services import log_audit
from orgs.models import Membership


class AuthRateThrottle(AnonRateThrottle):
    scope = "auth"


def tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        org = user._created_organization
        payload = {
            "user": UserSerializer(user).data,
            "organization": {"id": str(org.id), "name": org.name, "slug": org.slug},
            "role": user._created_role,
            "tokens": tokens_for_user(user),
        }
        log_audit(None, user, "auth.register", "user", str(user.id), request=request)
        return Response(payload, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        password = serializer.validated_data["password"]
        user = authenticate(request, username=email, password=password)
        if not user:
            return Response({"message": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        memberships = Membership.objects.filter(user=user, is_active=True).select_related("organization")
        org_id = serializer.validated_data.get("organization_id")
        membership = None
        if org_id:
            membership = memberships.filter(organization_id=org_id).first()
        if not membership:
            membership = memberships.first()
        data = {
            "user": UserSerializer(user).data,
            "tokens": tokens_for_user(user),
            "memberships": MembershipSerializer(memberships, many=True).data,
            "active_membership": MembershipSerializer(membership).data if membership else None,
        }
        log_audit(
            membership.organization if membership else None,
            user,
            "auth.login",
            "user",
            str(user.id),
            request=request,
        )
        return Response(data)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = Membership.objects.filter(user=request.user, is_active=True).select_related("organization")
        return Response(
            {
                "user": UserSerializer(request.user).data,
                "memberships": MembershipSerializer(memberships, many=True).data,
            }
        )


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        user = User.objects.filter(email=email).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            send_mail(
                "AI Viva password reset",
                f"Reset token for {email}: uid={uid} token={token}",
                None,
                [email],
            )
        return Response({"message": "If the account exists, reset instructions were sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            uid = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            user = User.objects.get(pk=uid)
        except Exception:
            return Response({"message": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)
        if not default_token_generator.check_token(user, serializer.validated_data["token"]):
            return Response({"message": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"message": "Password updated"})


class GoogleOAuthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        from django.conf import settings

        from accounts.services import provision_personal_workspace

        if not settings.GOOGLE_OAUTH_CLIENT_ID:
            return Response(
                {
                    "message": "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID to enable.",
                    "configured": False,
                },
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        credential = (request.data.get("credential") or request.data.get("id_token") or "").strip()
        if not credential:
            return Response({"message": "credential is required"}, status=status.HTTP_400_BAD_REQUEST)

        role = str(request.data.get("role") or Membership.Role.STUDENT).strip().lower()
        if role not in (Membership.Role.STUDENT, Membership.Role.INSTRUCTOR):
            role = Membership.Role.STUDENT

        try:
            from accounts.google import verify_google_id_token

            idinfo = verify_google_id_token(credential, settings.GOOGLE_OAUTH_CLIENT_ID)
        except ImportError:
            return Response(
                {"message": "Google auth library is not installed on the server."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )
        except Exception:
            return Response({"message": "Invalid Google credential"}, status=status.HTTP_401_UNAUTHORIZED)

        email = str(idinfo.get("email") or "").lower().strip()
        if not email or not idinfo.get("email_verified", True):
            return Response({"message": "Google account email is not available"}, status=status.HTTP_400_BAD_REQUEST)

        full_name = str(idinfo.get("name") or "").strip()
        avatar = str(idinfo.get("picture") or "").strip()
        created = False
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            user = User.objects.create_user(
                email=email,
                password=None,
                full_name=full_name,
                email_verified=True,
                avatar_url=avatar[:200] if avatar else "",
            )
            user.set_unusable_password()
            user.save(update_fields=["password"])
            created = True
        else:
            updates = []
            if not user.email_verified:
                user.email_verified = True
                updates.append("email_verified")
            if full_name and not user.full_name:
                user.full_name = full_name
                updates.append("full_name")
            if avatar and not user.avatar_url:
                user.avatar_url = avatar[:200]
                updates.append("avatar_url")
            if updates:
                user.save(update_fields=[*updates, "updated_at"] if hasattr(user, "updated_at") else updates)

        memberships = list(
            Membership.objects.filter(user=user, is_active=True).select_related("organization")
        )
        if not memberships:
            membership = provision_personal_workspace(user, role=role)
            memberships = [membership]
            created = True
        membership = memberships[0]
        payload = {
            "user": UserSerializer(user).data,
            "tokens": tokens_for_user(user),
            "memberships": MembershipSerializer(memberships, many=True).data,
            "active_membership": MembershipSerializer(membership).data,
            "created": created,
        }
        log_audit(
            membership.organization,
            user,
            "auth.google" if not created else "auth.google.register",
            "user",
            str(user.id),
            request=request,
        )
        return Response(payload, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
