from __future__ import annotations

from collections import Counter
from typing import Iterable

from submissions.repository.classify import CONFIG_NAMES


ENTRY_HINTS = {
    "main.py",
    "app.py",
    "manage.py",
    "wsgi.py",
    "asgi.py",
    "index.js",
    "index.ts",
    "index.tsx",
    "App.jsx",
    "App.tsx",
    "server.js",
    "main.go",
    "main.rs",
    "Program.cs",
}


def build_project_profile(
    *,
    owner: str,
    repo: str,
    commit_sha: str,
    files: Iterable,
    symbols: Iterable,
    dependencies: Iterable,
) -> dict:
    file_list = list(files)
    symbol_list = list(symbols)
    dep_list = list(dependencies)
    languages = Counter(f.language for f in file_list if getattr(f, "indexed", False) and f.language)
    categories = Counter(f.category for f in file_list)
    indexed = [f for f in file_list if getattr(f, "indexed", False)]
    paths = [f.path for f in indexed]
    top_dirs = Counter(p.split("/")[0] for p in paths if "/" in p)
    manifests = [
        f.path
        for f in indexed
        if f.path.split("/")[-1].lower() in {n.lower() for n in CONFIG_NAMES} or f.category == "configuration"
    ]
    readmes = [f.path for f in indexed if f.path.split("/")[-1].lower().startswith("readme")]
    entry_points = [f.path for f in indexed if f.path.split("/")[-1] in ENTRY_HINTS]
    routes = [s.name for s in symbol_list if getattr(s, "kind", "") == "route"][:20]
    important_symbols = [
        {"name": s.name, "kind": s.kind, "file": getattr(s.repository_file, "path", "")}
        for s in symbol_list
        if getattr(s, "kind", "") in {"function", "class", "method"}
    ][:40]
    resolved_edges = [
        {"from": d.from_path, "to": d.to_path, "kind": d.kind}
        for d in dep_list
        if getattr(d, "resolved", False)
    ][:40]

    stack = []
    lang_set = set(languages)
    if "python" in lang_set:
        stack.append("Python")
    if "javascript" in lang_set or "typescript" in lang_set:
        stack.append("JavaScript/TypeScript")
    if "java" in lang_set:
        stack.append("Java")
    if "go" in lang_set:
        stack.append("Go")
    if "rust" in lang_set:
        stack.append("Rust")

    return {
        "owner": owner,
        "repo": repo,
        "commit_sha": commit_sha,
        "languages": dict(languages),
        "categories": dict(categories),
        "top_directories": dict(top_dirs.most_common(12)),
        "manifests": manifests[:20],
        "readmes": readmes[:8],
        "entry_points": entry_points[:12],
        "routes": routes,
        "stack": stack,
        "symbol_count": len(symbol_list),
        "important_symbols": important_symbols,
        "dependency_edges": resolved_edges,
        "indexed_files": len(indexed),
        "skipped_files": sum(1 for f in file_list if not getattr(f, "indexed", False)),
    }


def profile_summary_text(profile: dict) -> str:
    if not profile:
        return ""
    parts = [
        f"Repository {profile.get('owner')}/{profile.get('repo')} @ {profile.get('commit_sha', '')[:8]}",
        f"Stack: {', '.join(profile.get('stack') or []) or 'unknown'}",
        f"Languages: {profile.get('languages')}",
        f"Entry points: {', '.join(profile.get('entry_points') or []) or 'n/a'}",
        f"Top directories: {list((profile.get('top_directories') or {}).keys())}",
        f"Manifests: {', '.join(profile.get('manifests') or []) or 'n/a'}",
    ]
    return "\n".join(parts)
