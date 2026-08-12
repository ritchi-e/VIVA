from __future__ import annotations

import os
import shutil
import tempfile
from urllib.parse import urlparse

from submissions.adapters.base import BaseSubmissionAdapter, ExtractedDocument

READ_EXTENSIONS = {".md", ".txt", ".py", ".java", ".c", ".cpp", ".h", ".js", ".ts", ".json", ".yaml", ".yml", ".rst"}


def _clone_repo(url: str, tmpdir: str) -> None:
    """Clone via GitPython; requires the system `git` binary (installed in the Docker image)."""
    try:
        from git import Repo
    except ImportError as exc:
        raise RuntimeError(
            "GitPython could not initialize. Ensure the `git` executable is installed in PATH."
        ) from exc
    Repo.clone_from(url, tmpdir, depth=1)


class GithubAdapter(BaseSubmissionAdapter):
    """Clone repository read-only and extract text sources. Never executes student code."""

    file_type = "github"

    def extract(self, data: bytes, filename: str) -> ExtractedDocument:
        url = data.decode("utf-8").strip() if data else filename
        parsed = urlparse(url)
        if not parsed.scheme:
            url = f"https://github.com/{url}"
        tmpdir = tempfile.mkdtemp(prefix="aiviva-github-")
        try:
            _clone_repo(url, tmpdir)
            texts = []
            files_meta = []
            for root, _dirs, files in os.walk(tmpdir):
                if ".git" in root.split(os.sep):
                    continue
                for fname in files:
                    path = os.path.join(root, fname)
                    rel = os.path.relpath(path, tmpdir)
                    lower = rel.lower()
                    if not any(lower.endswith(ext) for ext in READ_EXTENSIONS):
                        files_meta.append({"path": rel, "skipped": True})
                        continue
                    try:
                        with open(path, encoding="utf-8", errors="replace") as fh:
                            content = fh.read(200_000)
                    except OSError:
                        continue
                    texts.append(f"--- {rel} ---\n{content}")
                    files_meta.append({"path": rel, "chars": len(content)})
            return ExtractedDocument(
                text="\n\n".join(texts),
                structure={"repo": url, "files": files_meta},
                source_ref=url,
            )
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def extract_from_url(self, github_url: str) -> ExtractedDocument:
        return self.extract(github_url.encode("utf-8"), github_url)
