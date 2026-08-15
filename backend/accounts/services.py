from __future__ import annotations

from django.utils.text import slugify

from accounts.models import User
from orgs.models import Membership, Organization


def unique_org_slug(name: str) -> str:
    base = slugify(name)[:40] or "workspace"
    slug = base
    i = 1
    while Organization.objects.filter(slug=slug).exists():
        slug = f"{base}-{i}"
        i += 1
    return slug


def provision_personal_workspace(user: User, *, role: str, organization_name: str = "") -> Membership:
    org_name = organization_name.strip() or f"{user.full_name or user.email.split('@')[0]} workspace"
    org = Organization.objects.create(name=org_name, slug=unique_org_slug(org_name))
    return Membership.objects.create(organization=org, user=user, role=role)
