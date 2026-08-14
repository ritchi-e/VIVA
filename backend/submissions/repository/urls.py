from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

GITHUB_HOSTS = {"github.com", "www.github.com"}
_OWNER_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$")
_REPO_RE = re.compile(r"^[A-Za-z0-9._-]{1,100}$")


class GithubUrlError(ValueError):
    """Raised when a GitHub URL is not a supported public repository URL."""


@dataclass(frozen=True)
class ParsedGithubUrl:
    owner: str
    repo: str
    ref: str | None
    canonical_url: str


def parse_github_url(raw: str) -> ParsedGithubUrl:
    if not raw or not str(raw).strip():
        raise GithubUrlError("Provide a public GitHub repository URL.")
    text = str(raw).strip()
    if " " in text or "\n" in text:
        raise GithubUrlError("GitHub URL contains invalid whitespace.")
    if not re.match(r"^https?://", text, re.I):
        if text.startswith("github.com/") or text.startswith("www.github.com/"):
            text = "https://" + text
        else:
            raise GithubUrlError("Use an https://github.com/{owner}/{repo} URL.")

    parsed = urlparse(text)
    if parsed.scheme != "https":
        raise GithubUrlError("GitHub URLs must use https.")
    host = (parsed.hostname or "").lower()
    if host not in GITHUB_HOSTS:
        raise GithubUrlError("Only public github.com repositories are supported.")
    if parsed.username or parsed.password:
        raise GithubUrlError("Repository URLs must not include credentials.")
    if parsed.query or parsed.fragment:
        raise GithubUrlError("Remove query parameters and fragments from the GitHub URL.")
    if parsed.port not in (None, 443):
        raise GithubUrlError("GitHub URLs must use the default HTTPS port.")

    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) < 2:
        raise GithubUrlError("URL must be https://github.com/{owner}/{repo}.")
    owner, repo = parts[0], parts[1]
    if repo.endswith(".git"):
        repo = repo[:-4]
    if owner.lower() in {"gist", "marketplace", "settings", "orgs", "users", "login", "new"}:
        raise GithubUrlError("That GitHub path is not a repository.")
    if not _OWNER_RE.match(owner) or not _REPO_RE.match(repo) or repo in {".", ".."}:
        raise GithubUrlError("Repository owner or name is invalid.")

    ref = None
    if len(parts) >= 4 and parts[2] in {"tree", "commit", "blob"}:
        ref = "/".join(parts[3:]) if parts[2] != "blob" else parts[3]
        if parts[2] == "blob" and len(parts) > 4:
            ref = parts[3]
    elif len(parts) > 2 and parts[2] not in {"tree", "commit", "blob", "issues", "pull", "actions"}:
        raise GithubUrlError("Unsupported GitHub URL path. Use the repository root or a /tree/{ref} link.")

    canonical = f"https://github.com/{owner}/{repo}"
    return ParsedGithubUrl(owner=owner, repo=repo, ref=ref, canonical_url=canonical)
