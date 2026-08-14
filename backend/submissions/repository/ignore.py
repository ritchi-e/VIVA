from __future__ import annotations

import os
import posixpath
import re
from fnmatch import fnmatch

DENY_DIR_NAMES = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "bower_components",
    "vendor",
    "dist",
    "build",
    "out",
    "coverage",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".tox",
    ".idea",
    ".vscode",
    "target",
    "Pods",
}

DENY_FILE_NAMES = {
    ".env",
    ".env.local",
    ".env.production",
    "id_rsa",
    "id_dsa",
    "id_ed25519",
    ".DS_Store",
}

DENY_SUFFIXES = (
    ".pyc",
    ".pyo",
    ".so",
    ".dylib",
    ".dll",
    ".exe",
    ".bin",
    ".o",
    ".a",
    ".class",
    ".jar",
    ".war",
    ".zip",
    ".tar",
    ".gz",
    ".tgz",
    ".7z",
    ".rar",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".mp4",
    ".mov",
    ".avi",
    ".mp3",
    ".wav",
    ".pdf",
    ".docx",
    ".pptx",
    ".xlsx",
    ".min.js",
    ".min.css",
    ".map",
    ".lock",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
)

DENY_GLOBS = (
    "*.min.js",
    "*.min.css",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "Gemfile.lock",
)


def _normalize(path: str) -> str:
    rel = path.replace("\\", "/")
    while rel.startswith("./"):
        rel = rel[2:]
    return rel.lstrip("/")


def should_deny_path(path: str) -> str | None:
    rel = _normalize(path)
    if not rel or rel.endswith("/"):
        return "empty_path"
    parts = [p for p in rel.split("/") if p]
    if any(part in DENY_DIR_NAMES for part in parts):
        return "ignored_directory"
    name = parts[-1]
    if name in DENY_FILE_NAMES:
        return "secret_or_local_file"
    lower = name.lower()
    if any(lower.endswith(suf) for suf in DENY_SUFFIXES):
        return "binary_or_generated"
    if any(fnmatch(name, glob) or fnmatch(rel, glob) for glob in DENY_GLOBS):
        return "lockfile_or_generated"
    if name.startswith("id_") and "rsa" in name:
        return "secret_or_local_file"
    return None


def parse_gitignore(text: str) -> list[str]:
    patterns: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("!"):
            continue
        patterns.append(line.rstrip("/"))
    return patterns


def matches_gitignore(path: str, patterns: list[str]) -> bool:
    rel = _normalize(path)
    name = os.path.basename(rel)
    for pattern in patterns:
        pat = pattern.lstrip("/")
        if fnmatch(rel, pat) or fnmatch(name, pat) or fnmatch(rel, f"*/{pat}"):
            return True
        if pat.endswith("/") and (rel.startswith(pat) or f"/{pat}" in f"/{rel}/"):
            return True
    return False
