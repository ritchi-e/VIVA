from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings


@dataclass(frozen=True)
class RepoLimits:
    archive_bytes: int
    max_files: int
    file_bytes: int
    extracted_chars: int
    fetch_timeout: int
    parser_concurrency: int


class RepoLimitError(ValueError):
    """Raised when a repository exceeds configured ingestion limits."""


def get_repo_limits() -> RepoLimits:
    return RepoLimits(
        archive_bytes=int(getattr(settings, "MAX_REPO_ARCHIVE_BYTES", 40 * 1024 * 1024)),
        max_files=int(getattr(settings, "MAX_REPO_FILES", 400)),
        file_bytes=int(getattr(settings, "MAX_REPO_FILE_BYTES", 400 * 1024)),
        extracted_chars=int(getattr(settings, "MAX_EXTRACTED_CHARS", 400_000)),
        fetch_timeout=int(getattr(settings, "REPO_FETCH_TIMEOUT_SEC", 45)),
        parser_concurrency=int(getattr(settings, "REPO_PARSER_CONCURRENCY", 4)),
    )


def static_ingestion_enabled() -> bool:
    return bool(getattr(settings, "GITHUB_STATIC_INGESTION_ENABLED", True))
