from __future__ import annotations

import hashlib
import logging
import time
from collections import defaultdict

from submissions.metrics import INGESTION_STAGE_DURATION, PARSE_FAILURES, REPO_FILES
from submissions.models import (
    CodeDependency,
    CodeSymbol,
    RepositoryFile,
    RepositorySnapshot,
    Submission,
    SubmissionChunk,
)
from submissions.repository.chunk import semantic_units, source_ref_for
from submissions.repository.extract import extract_zip_inventory
from submissions.repository.fetch import GithubFetchError, load_archive, persist_archive, resolve_and_download
from submissions.repository.limits import RepoLimitError, static_ingestion_enabled
from submissions.repository.parse import parse_source
from submissions.repository.profile import build_project_profile
from submissions.repository.urls import GithubUrlError, parse_github_url

logger = logging.getLogger(__name__)


def _time_stage(snapshot: RepositorySnapshot, name: str, started: float) -> None:
    elapsed = time.monotonic() - started
    timings = dict(snapshot.stage_timings or {})
    timings[name] = round(elapsed, 3)
    snapshot.stage_timings = timings
    snapshot.save(update_fields=["stage_timings", "updated_at"])
    INGESTION_STAGE_DURATION.labels(stage=name).observe(elapsed)


def _set_stage(submission: Submission, stage: str) -> None:
    submission.processing_stage = stage
    submission.save(update_fields=["processing_stage", "updated_at"])


def ingest_github_repository(submission: Submission) -> RepositorySnapshot | None:
    if not submission.github_url:
        return None
    if not static_ingestion_enabled():
        return None

    parsed = parse_github_url(submission.github_url)
    snapshot, _created = RepositorySnapshot.objects.get_or_create(
        submission=submission,
        defaults={
            "github_url": parsed.canonical_url,
            "owner": parsed.owner,
            "repo": parsed.repo,
            "status": RepositorySnapshot.Status.PENDING,
        },
    )
    snapshot.github_url = parsed.canonical_url
    snapshot.owner = parsed.owner
    snapshot.repo = parsed.repo
    snapshot.status = RepositorySnapshot.Status.FETCHING
    snapshot.error_message = ""
    snapshot.save(update_fields=["github_url", "owner", "repo", "status", "error_message", "updated_at"])
    _set_stage(submission, Submission.ProcessingStage.FETCHING_REPOSITORY)

    started = time.monotonic()
    try:
        if snapshot.archive_storage_key and snapshot.commit_sha:
            archive = load_archive(snapshot.archive_storage_key)
        else:
            meta = resolve_and_download(parsed)
            org_id = submission.assignment.course.organization_id
            key = persist_archive(org_id, submission.id, meta.commit_sha, meta.archive_bytes)
            snapshot.default_branch = meta.default_branch
            snapshot.commit_sha = meta.commit_sha
            snapshot.archive_storage_key = key
            snapshot.total_bytes = len(meta.archive_bytes)
            snapshot.save(
                update_fields=[
                    "default_branch",
                    "commit_sha",
                    "archive_storage_key",
                    "total_bytes",
                    "updated_at",
                ]
            )
            archive = meta.archive_bytes
        _time_stage(snapshot, "fetching_repository", started)
    except (GithubUrlError, GithubFetchError, RepoLimitError):
        raise
    except Exception as exc:
        logger.exception("GitHub fetch failed for submission %s", submission.id)
        raise GithubFetchError(f"Could not fetch the repository: {exc}") from exc

    _set_stage(submission, Submission.ProcessingStage.INDEXING_FILES)
    started = time.monotonic()
    inventory = extract_zip_inventory(archive)
    snapshot.files.all().delete()
    file_rows: list[RepositoryFile] = []
    for item in inventory:
        REPO_FILES.labels(result="indexed" if item.indexed else "skipped", reason=item.skip_reason or "ok").inc()
        file_rows.append(
            RepositoryFile(
                snapshot=snapshot,
                path=item.path[:1024],
                language=item.language[:32],
                category=item.category,
                size_bytes=item.size_bytes,
                content_hash=item.content_hash,
                indexed=item.indexed,
                skip_reason=item.skip_reason[:128],
                extracted_text=item.content[:120_000] if item.indexed else "",
            )
        )
    RepositoryFile.objects.bulk_create(file_rows, batch_size=200)
    snapshot.files_indexed = sum(1 for item in inventory if item.indexed)
    snapshot.files_skipped = sum(1 for item in inventory if not item.indexed)
    snapshot.extracted_chars = sum(len(item.content) for item in inventory if item.indexed)
    snapshot.save(update_fields=["files_indexed", "files_skipped", "extracted_chars", "updated_at"])
    _time_stage(snapshot, "indexing_files", started)

    _set_stage(submission, Submission.ProcessingStage.ANALYZING_STRUCTURE)
    started = time.monotonic()
    snapshot.symbols.all().delete()
    snapshot.dependencies.all().delete()
    files_by_path = {f.path: f for f in snapshot.files.filter(indexed=True)}
    symbol_rows: list[CodeSymbol] = []
    imports_by_file: dict[str, list] = defaultdict(list)
    for repo_file in files_by_path.values():
        try:
            parsed_source = parse_source(repo_file.extracted_text, repo_file.language)
        except Exception:
            PARSE_FAILURES.labels(language=repo_file.language or "unknown").inc()
            continue
        for symbol in parsed_source.symbols:
            symbol_rows.append(
                CodeSymbol(
                    snapshot=snapshot,
                    repository_file=repo_file,
                    name=symbol.name[:256],
                    kind=symbol.kind if symbol.kind in {c.value for c in CodeSymbol.Kind} else CodeSymbol.Kind.OTHER,
                    signature=symbol.signature[:1024],
                    docstring=symbol.docstring[:4000],
                    start_line=symbol.start_line,
                    end_line=symbol.end_line,
                    language=repo_file.language,
                    metadata=symbol.metadata,
                )
            )
        imports_by_file[repo_file.path] = parsed_source.imports
    CodeSymbol.objects.bulk_create(symbol_rows, batch_size=200)

    dep_rows: list[CodeDependency] = []
    for path, imports in imports_by_file.items():
        from_file = files_by_path.get(path)
        if not from_file:
            continue
        for imported in imports:
            target = _resolve_import(imported.module, path, files_by_path)
            dep_rows.append(
                CodeDependency(
                    snapshot=snapshot,
                    from_file=from_file,
                    to_file=target,
                    from_path=path,
                    to_path=target.path if target else imported.module[:1024],
                    kind=CodeDependency.Kind.IMPORT if target else CodeDependency.Kind.UNRESOLVED,
                    resolved=bool(target),
                    metadata={"module": imported.module, "names": imported.names},
                )
            )
    CodeDependency.objects.bulk_create(dep_rows, batch_size=200)

    snapshot.project_profile = build_project_profile(
        owner=snapshot.owner,
        repo=snapshot.repo,
        commit_sha=snapshot.commit_sha,
        files=list(snapshot.files.all()),
        symbols=list(snapshot.symbols.all()),
        dependencies=list(snapshot.dependencies.all()),
    )
    snapshot.status = RepositorySnapshot.Status.INDEXED
    snapshot.save(update_fields=["project_profile", "status", "updated_at"])
    _time_stage(snapshot, "analyzing_structure", started)
    return snapshot


def create_repository_chunks(submission: Submission, snapshot: RepositorySnapshot, start_index: int = 0) -> list[SubmissionChunk]:
    chunks: list[SubmissionChunk] = []
    index = start_index
    symbols_by_file: dict[str, list] = defaultdict(list)
    for symbol in snapshot.symbols.all():
        symbols_by_file[symbol.repository_file_id].append(
            type("S", (), {
                "name": symbol.name,
                "kind": symbol.kind,
                "signature": symbol.signature,
                "docstring": symbol.docstring,
                "start_line": symbol.start_line,
                "end_line": symbol.end_line,
                "body": "",
                "metadata": symbol.metadata,
            })()
        )
    # Re-parse bodies from file text for chunk content
    from submissions.repository.parse import parse_source as _parse

    for repo_file in snapshot.files.filter(indexed=True):
        parsed = _parse(repo_file.extracted_text, repo_file.language)
        kind_map = {"function": "function", "class": "class", "method": "method"}
        config_kind = "config" if repo_file.category == "configuration" else None
        units = semantic_units(repo_file.path, repo_file.extracted_text, repo_file.language, parsed.symbols)
        for unit in units:
            kind = unit["kind"]
            if config_kind and kind in {"document", "fallback"}:
                kind = "config"
            content = unit["content"]
            digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
            chunks.append(
                SubmissionChunk(
                    submission=submission,
                    repository_file=repo_file,
                    chunk_index=index,
                    content=content,
                    token_count=len(content.split()),
                    metadata={
                        "path": unit["path"],
                        "language": unit["language"],
                        "symbol": unit["symbol"],
                        "start_line": unit["start_line"],
                        "end_line": unit["end_line"],
                    },
                    source_ref=source_ref_for(unit["path"], unit["start_line"], unit["end_line"]),
                    path=unit["path"],
                    language=unit["language"],
                    symbol=unit["symbol"],
                    start_line=unit["start_line"],
                    end_line=unit["end_line"],
                    content_hash=digest,
                    chunk_kind=kind if kind in {c.value for c in SubmissionChunk.ChunkKind} else SubmissionChunk.ChunkKind.FALLBACK,
                )
            )
            index += 1
    return chunks


def _resolve_import(module: str, from_path: str, files_by_path: dict[str, RepositoryFile]) -> RepositoryFile | None:
    if not module:
        return None
    candidates = []
    dotted = module.replace(".", "/")
    slashed = module.replace("\\", "/")
    for suffix in (f"{dotted}.py", f"{dotted}/__init__.py", f"{slashed}.py", f"{slashed}.ts", f"{slashed}.js", f"{slashed}.tsx"):
        candidates.append(suffix.lstrip("/"))
    base_dir = "/".join(from_path.split("/")[:-1])
    if module.startswith("."):
        candidates.append(f"{base_dir}/{module.lstrip('./')}.py")
    for cand in candidates:
        if cand in files_by_path:
            return files_by_path[cand]
    # basename match as unresolved-safe last resort only if unique
    name = module.split(".")[-1].split("/")[-1]
    matches = [f for path, f in files_by_path.items() if path.rsplit(".", 1)[0].endswith("/" + name) or path.rsplit(".", 1)[0] == name]
    if len(matches) == 1:
        return matches[0]
    return None
