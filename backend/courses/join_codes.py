from __future__ import annotations

import secrets

JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_join_code(length: int = 7) -> str:
    return "".join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(length))


def allocate_join_code(*, model=None, length: int = 7, attempts: int = 24) -> str:
    """Return a unique join code. Pass the Course model when available."""
    Course = model
    if Course is None:
        from courses.models import Course as Course  # noqa: N806

    for _ in range(attempts):
        code = generate_join_code(length)
        if not Course.objects.filter(join_code=code).exists():
            return code
    raise RuntimeError("Could not allocate a unique course join code")
