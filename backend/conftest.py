import pytest


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def org_user(db):
    from accounts.models import User
    from orgs.models import Membership, Organization

    user = User.objects.create_user(email="instructor@example.com", password="password123")
    org = Organization.objects.create(name="Test Org", slug="test-org")
    Membership.objects.create(
        organization=org,
        user=user,
        role=Membership.Role.INSTRUCTOR,
    )
    return user, org


@pytest.fixture
def student_user(db, org_user):
    from accounts.models import User
    from orgs.models import Membership

    _instructor, org = org_user
    student = User.objects.create_user(email="student@example.com", password="password123")
    Membership.objects.create(organization=org, user=student, role=Membership.Role.STUDENT)
    return student, org


@pytest.fixture(autouse=True)
def _celery_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_STORE_EAGER_RESULT = True
