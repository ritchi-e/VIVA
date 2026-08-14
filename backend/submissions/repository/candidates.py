from __future__ import annotations

from submissions.models import QuestionCandidate, RepositorySnapshot, SubmissionChunk


def generate_question_candidates(snapshot: RepositorySnapshot) -> list[QuestionCandidate]:
    snapshot.question_candidates.all().delete()
    chunks = list(
        SubmissionChunk.objects.filter(submission=snapshot.submission).order_by("chunk_index")
    )
    by_path: dict[str, list[SubmissionChunk]] = {}
    for chunk in chunks:
        if chunk.path:
            by_path.setdefault(chunk.path, []).append(chunk)

    created: list[QuestionCandidate] = []
    profile = snapshot.project_profile or {}

    readme_chunks = []
    for path in profile.get("readmes") or []:
        readme_chunks.extend(by_path.get(path, [])[:2])
    if readme_chunks or profile:
        created.append(
            QuestionCandidate.objects.create(
                snapshot=snapshot,
                submission=snapshot.submission,
                level=QuestionCandidate.Level.PROJECT,
                question_type="conceptual",
                prompt_hint=(
                    "Ask about the main objective of this project and how the major components fit together, "
                    "using the README and directory map as evidence. Do not claim the project runs."
                ),
                evidence_chunk_ids=[str(c.id) for c in readme_chunks[:3]],
                source_ref=(readme_chunks[0].source_ref if readme_chunks else "repository"),
                metadata={"kind": "architecture"},
            )
        )
        if profile.get("entry_points") or profile.get("dependency_edges"):
            created.append(
                QuestionCandidate.objects.create(
                    snapshot=snapshot,
                    submission=snapshot.submission,
                    level=QuestionCandidate.Level.PROJECT,
                    question_type="methodology",
                    prompt_hint=(
                        "Ask how data or control flows from an entry point through imported modules. "
                        "Ground the question in the listed entry points and import edges."
                    ),
                    evidence_chunk_ids=[str(c.id) for c in _chunks_for_paths(by_path, profile.get("entry_points") or [])],
                    source_ref=(profile.get("entry_points") or ["repository"])[0],
                    metadata={"kind": "data_flow", "entry_points": profile.get("entry_points")},
                )
            )

    for chunk in chunks:
        if chunk.chunk_kind in {"function", "class", "method"} and chunk.symbol:
            created.append(
                QuestionCandidate.objects.create(
                    snapshot=snapshot,
                    submission=snapshot.submission,
                    level=QuestionCandidate.Level.IMPLEMENTATION,
                    question_type="implementation",
                    prompt_hint=(
                        f"Ask why `{chunk.symbol}` in `{chunk.path}` is structured this way, "
                        f"what it does, and what would break if a key step were removed. "
                        "Do not assert that it executes correctly."
                    ),
                    evidence_chunk_ids=[str(chunk.id)],
                    source_ref=chunk.source_ref,
                    start_line=chunk.start_line,
                    end_line=chunk.end_line,
                    metadata={"kind": "symbol", "symbol": chunk.symbol, "path": chunk.path},
                )
            )
            if len([c for c in created if c.level == QuestionCandidate.Level.IMPLEMENTATION]) >= 16:
                break

    config_chunks = [c for c in chunks if c.chunk_kind == "config" or (c.path or "").endswith(("requirements.txt", "package.json", "pyproject.toml", "Dockerfile"))]
    if config_chunks:
        created.append(
            QuestionCandidate.objects.create(
                snapshot=snapshot,
                submission=snapshot.submission,
                level=QuestionCandidate.Level.IMPLEMENTATION,
                question_type="application",
                prompt_hint="Ask about a specific dependency or configuration choice visible in the manifest files.",
                evidence_chunk_ids=[str(c.id) for c in config_chunks[:3]],
                source_ref=config_chunks[0].source_ref,
                metadata={"kind": "configuration"},
            )
        )

    test_chunks = [c for c in chunks if "/test" in f"/{c.path.lower()}" or c.path.lower().startswith("test")]
    if test_chunks:
        created.append(
            QuestionCandidate.objects.create(
                snapshot=snapshot,
                submission=snapshot.submission,
                level=QuestionCandidate.Level.IMPLEMENTATION,
                question_type="critical_thinking",
                prompt_hint="Ask what a listed test is checking and which failure the student would expect if the implementation changed.",
                evidence_chunk_ids=[str(c.id) for c in test_chunks[:3]],
                source_ref=test_chunks[0].source_ref,
                metadata={"kind": "testing"},
            )
        )

    created.append(
        QuestionCandidate.objects.create(
            snapshot=snapshot,
            submission=snapshot.submission,
            level=QuestionCandidate.Level.FOLLOW_UP,
            question_type="defense",
            prompt_hint=(
                "If the student answers vaguely, ask which metric, file, or data-flow step they used to make that choice, "
                "without asserting that the code works."
            ),
            evidence_chunk_ids=[],
            source_ref="",
            metadata={"kind": "follow_up_guidance"},
        )
    )
    return created


def _chunks_for_paths(by_path: dict[str, list], paths: list[str]) -> list[str]:
    ids: list[str] = []
    for path in paths[:4]:
        for chunk in by_path.get(path, [])[:2]:
            ids.append(str(chunk.id))
    return ids
