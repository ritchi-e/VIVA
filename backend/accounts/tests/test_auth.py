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
