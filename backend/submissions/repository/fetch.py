from __future__ import annotations

import logging
from dataclasses import dataclass
from io import BytesIO

import httpx
from django.conf import settings

from common.storage import download_bytes, upload_fileobj
from submissions.repository.limits import RepoLimitError, get_repo_limits
from submissions.repository.urls import ParsedGithubUrl

logger = logging.getLogger(__name__)

USER_AGENT = "AI-Viva-static-ingestion/1.0"


@dataclass
class GithubSnapshotMeta:
    owner: str
    repo: str
    default_branch: str
    commit_sha: str
    archive_bytes: bytes
    html_url: str


class GithubFetchError(ValueError):
    """Raised when a public GitHub repository cannot be fetched."""


def _headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = getattr(settings, "GITHUB_API_TOKEN", "") or ""
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _client(timeout: int) -> httpx.Client:
    return httpx.Client(
        timeout=httpx.Timeout(timeout, connect=min(10, timeout)),
        follow_redirects=True,
        headers=_headers(),
    )


def _ensure_github_host(url: str) -> None:
    host = httpx.URL(url).host.lower()
    allowed = {
        "github.com",
        "www.github.com",
        "api.github.com",
        "codeload.github.com",
        "objects.githubusercontent.com",
    }
    if host not in allowed and not host.endswith(".githubusercontent.com"):
        raise GithubFetchError("Refusing to follow a redirect off GitHub.")


def resolve_and_download(parsed: ParsedGithubUrl) -> GithubSnapshotMeta:
    limits = get_repo_limits()
    with _client(limits.fetch_timeout) as client:
        repo_url = f"https://api.github.com/repos/{parsed.owner}/{parsed.repo}"
        response = client.get(repo_url)
        if response.status_code == 404:
            raise GithubFetchError("Repository was not found or is not public.")
        if response.status_code == 403:
            raise GithubFetchError("GitHub rate-limited the request. Try again shortly.")
        if response.status_code >= 400:
            raise GithubFetchError(f"GitHub could not be reached ({response.status_code}).")
        data = response.json()
        if data.get("private"):
            raise GithubFetchError("Private repositories are not supported yet.")
        default_branch = parsed.ref or data.get("default_branch") or "main"
        html_url = data.get("html_url") or parsed.canonical_url

        commit_url = f"https://api.github.com/repos/{parsed.owner}/{parsed.repo}/commits/{default_branch}"
        commit_resp = client.get(commit_url)
        if commit_resp.status_code >= 400:
            raise GithubFetchError("Could not resolve the repository commit. Check the branch or tag.")
        commit_sha = (commit_resp.json().get("sha") or "").strip()
        if len(commit_sha) < 7:
            raise GithubFetchError("GitHub did not return a valid commit SHA.")

        archive_url = f"https://codeload.github.com/{parsed.owner}/{parsed.repo}/zip/{commit_sha}"
        with client.stream("GET", archive_url) as archive_resp:
            if archive_resp.status_code == 404:
                raise GithubFetchError("Repository archive was not found.")
            if archive_resp.status_code >= 400:
                raise GithubFetchError(f"Could not download the repository snapshot ({archive_resp.status_code}).")
            final_url = str(archive_resp.url)
            _ensure_github_host(final_url)
            chunks: list[bytes] = []
            total = 0
            for chunk in archive_resp.iter_bytes(64 * 1024):
                total += len(chunk)
                if total > limits.archive_bytes:
                    raise RepoLimitError(
                        f"Repository archive exceeds the {limits.archive_bytes} byte limit."
                    )
                chunks.append(chunk)
            archive = b"".join(chunks)
        if not archive:
            raise GithubFetchError("Downloaded repository archive was empty.")

    return GithubSnapshotMeta(
        owner=parsed.owner,
        repo=parsed.repo,
        default_branch=default_branch,
        commit_sha=commit_sha,
        archive_bytes=archive,
        html_url=html_url,
    )


def persist_archive(org_id, submission_id, commit_sha: str, archive: bytes) -> str:
    key = f"orgs/{org_id}/submissions/{submission_id}/github-{commit_sha[:12]}.zip"
    upload_fileobj(BytesIO(archive), key, content_type="application/zip")
    return key


def load_archive(storage_key: str) -> bytes:
    return download_bytes(storage_key)
