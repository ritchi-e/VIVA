from __future__ import annotations

import io
import posixpath
import zipfile
from dataclasses import dataclass

from submissions.repository.classify import classify_file, is_probably_binary
from submissions.repository.ignore import matches_gitignore, parse_gitignore, should_deny_path
from submissions.repository.limits import RepoLimitError, get_repo_limits


@dataclass
class ExtractedRepoFile:
    path: str
    content: str
    size_bytes: int
    content_hash: str
    category: str
    language: str
    indexed: bool
    skip_reason: str = ""


def _safe_member_path(name: str) -> str | None:
    raw = name.replace("\\", "/")
    if raw.startswith("/") or raw.startswith("\\"):
        return None
    parts = []
    for part in raw.split("/"):
        if part in {"", "."}:
            continue
        if part == "..":
            return None
        parts.append(part)
    if not parts:
        return None
    # GitHub zipballs nest files under {repo}-{sha}/...
    if len(parts) > 1:
        parts = parts[1:]
    if not parts:
        return None
    return posixpath.join(*parts)


def extract_zip_inventory(archive: bytes) -> list[ExtractedRepoFile]:
    import hashlib

    limits = get_repo_limits()
    files: list[ExtractedRepoFile] = []
    gitignore_patterns: list[str] = []
    extracted_chars = 0
    indexed_count = 0

    try:
        zf = zipfile.ZipFile(io.BytesIO(archive))
    except zipfile.BadZipFile as exc:
        raise RepoLimitError("Repository archive is not a valid zip snapshot.") from exc

    # Load .gitignore first if present
    for info in zf.infolist():
        path = _safe_member_path(info.filename)
        if path and path.split("/")[-1] == ".gitignore":
            try:
                gitignore_patterns = parse_gitignore(zf.read(info).decode("utf-8", errors="replace"))
            except Exception:
                gitignore_patterns = []
            break

    for info in zf.infolist():
        if info.is_dir():
            continue
        path = _safe_member_path(info.filename)
        if not path:
            files.append(
                ExtractedRepoFile(
                    path=info.filename,
                    content="",
                    size_bytes=info.file_size,
                    content_hash="",
                    category="unsupported",
                    language="",
                    indexed=False,
                    skip_reason="unsafe_path",
                )
            )
            continue

        deny = should_deny_path(path)
        if deny:
            files.append(
                ExtractedRepoFile(path, "", info.file_size, "", "generated", "", False, deny)
            )
            continue
        if matches_gitignore(path, gitignore_patterns):
            files.append(
                ExtractedRepoFile(path, "", info.file_size, "", "generated", "", False, "gitignore")
            )
            continue

        category, language = classify_file(path)
        if category in {"binary", "dataset", "unsupported", "generated"}:
            files.append(
                ExtractedRepoFile(path, "", info.file_size, "", category, language, False, category)
            )
            continue
        if info.file_size > limits.file_bytes:
            files.append(
                ExtractedRepoFile(path, "", info.file_size, "", category, language, False, "file_too_large")
            )
            continue

        try:
            raw = zf.read(info)
        except Exception:
            files.append(
                ExtractedRepoFile(path, "", info.file_size, "", category, language, False, "unreadable")
            )
            continue
        if is_probably_binary(raw):
            files.append(
                ExtractedRepoFile(path, "", len(raw), "", "binary", language, False, "binary")
            )
            continue

        if indexed_count >= limits.max_files:
            files.append(
                ExtractedRepoFile(path, "", len(raw), "", category, language, False, "file_limit")
            )
            continue

        text = raw.decode("utf-8", errors="replace")
        if extracted_chars + len(text) > limits.extracted_chars:
            remaining = limits.extracted_chars - extracted_chars
            if remaining < 200:
                files.append(
                    ExtractedRepoFile(path, "", len(raw), "", category, language, False, "extracted_char_limit")
                )
                continue
            text = text[:remaining]
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        files.append(
            ExtractedRepoFile(
                path=path,
                content=text,
                size_bytes=len(raw),
                content_hash=digest,
                category=category,
                language=language,
                indexed=True,
            )
        )
        extracted_chars += len(text)
        indexed_count += 1

    return files
