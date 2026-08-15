from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import (
    GoogleOAuthView,
    LoginView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
)

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("me/", MeView.as_view()),
    path("token/refresh/", TokenRefreshView.as_view()),
    path("password-reset/", PasswordResetRequestView.as_view()),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view()),
    path("google/", GoogleOAuthView.as_view()),
]
