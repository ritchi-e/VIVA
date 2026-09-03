from __future__ import annotations

from typing import Any

# Keep tab/newline/carriage return; drop NUL and other C0 controls that PostgreSQL rejects.
_DROP_CONTROLS = dict.fromkeys(range(32))
del _DROP_CONTROLS[9]
del _DROP_CONTROLS[10]
del _DROP_CONTROLS[13]


def sanitize_text(value: str | None) -> str:
    """Strip NUL and other control characters so Postgres text/JSON fields can store the value."""
    if not value:
        return ""
    return value.replace("\x00", "").translate(_DROP_CONTROLS)


def sanitize_json(value: Any) -> Any:
    if isinstance(value, str):
        return sanitize_text(value)
    if isinstance(value, dict):
        return {str(key): sanitize_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize_json(item) for item in value]
    if isinstance(value, tuple):
        return [sanitize_json(item) for item in value]
    return value
