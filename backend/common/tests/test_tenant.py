import pytest
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from assignments.models import Assignment
from courses.models import Course


@pytest.mark.django_db
def test_tenant_isolation_on_courses(api_client, org_user, student_user):
    instructor, org = org_user
    student, _student_org = student_user

    from orgs.models import Membership, Organization

    other_org = Organization.objects.create(name="Other", slug="other-org")
    Membership.objects.create(organization=other_org, user=instructor, role=Membership.Role.INSTRUCTOR)

    token = str(RefreshToken.for_user(instructor).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}", HTTP_X_ORGANIZATION_ID=str(org.id))

    Course.objects.create(organization=org, code="CS101", title="Intro", created_by=instructor)
    Course.objects.create(organization=other_org, code="CS102", title="Hidden", created_by=instructor)

    resp = api_client.get("/api/courses/")
    assert resp.status_code == status.HTTP_200_OK
    codes = {item["code"] for item in resp.data["results"]}
    assert codes == {"CS101"}
