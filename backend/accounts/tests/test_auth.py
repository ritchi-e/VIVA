import pytest
from rest_framework import status


@pytest.mark.django_db
def test_register_and_login(api_client):
    reg = api_client.post(
        "/api/auth/register/",
        {"email": "new@example.com", "password": "password123", "organization_name": "Acme"},
        format="json",
    )
    assert reg.status_code == status.HTTP_201_CREATED
    assert "tokens" in reg.data

    login = api_client.post(
        "/api/auth/login/",
        {"email": "new@example.com", "password": "password123"},
        format="json",
    )
    assert login.status_code == status.HTTP_200_OK
    assert login.data["tokens"]["access"]


@pytest.mark.django_db
def test_me_requires_auth(api_client):
    resp = api_client.get("/api/auth/me/")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_google_oauth_not_configured(api_client, settings):
    settings.GOOGLE_OAUTH_CLIENT_ID = ""
    resp = api_client.post("/api/auth/google/", {"credential": "x"}, format="json")
    assert resp.status_code == status.HTTP_501_NOT_IMPLEMENTED


@pytest.mark.django_db
def test_google_oauth_creates_user(api_client, settings, monkeypatch):
    settings.GOOGLE_OAUTH_CLIENT_ID = "test-client.apps.googleusercontent.com"

    def fake_verify(token, audience):
        assert token == "valid-google-token"
        assert audience == settings.GOOGLE_OAUTH_CLIENT_ID
        return {
            "email": "google.student@example.com",
            "email_verified": True,
            "name": "Google Student",
            "picture": "https://example.com/a.png",
        }

    monkeypatch.setattr("accounts.google.verify_google_id_token", fake_verify)

    resp = api_client.post(
        "/api/auth/google/",
        {"credential": "valid-google-token", "role": "student"},
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.data["tokens"]["access"]
    assert resp.data["user"]["email"] == "google.student@example.com"
    assert resp.data["active_membership"]["role"] == "student"

    again = api_client.post(
        "/api/auth/google/",
        {"credential": "valid-google-token"},
        format="json",
    )
    assert again.status_code == status.HTTP_200_OK
    assert again.data["user"]["id"] == resp.data["user"]["id"]

