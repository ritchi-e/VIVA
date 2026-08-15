from __future__ import annotations

import re
from typing import Iterable

from django.core.exceptions import ObjectDoesNotExist

from submissions.models import CodeSymbol, Submission, SubmissionChunk
from viva.models import VivaSession

_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_\-./]{1,63}")
_STOP = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "your",
    "file",
    "code",
    "function",
    "class",
    "method",
    "data",
    "main",
    "test",
    "src",
    "app",
    "true",
    "false",
    "none",
    "null",
    "return",
}


def build_stt_keyterms(submission: Submission, *, session: VivaSession | None = None, limit: int = 80) -> list[str]:
    """Project vocabulary for Deepgram Nova-3 keyterm prompting (max ~100 terms)."""
    terms: list[str] = []
    seen: set[str] = set()

    def add(raw: str | None, *, allow_multi: bool = True):
        if not raw:
            return
        text = " ".join(str(raw).split()).strip(" .,;:()[]{}\"'`")
        if not text or len(text) < 2:
            return
        if not allow_multi and " " in text:
            text = text.split()[0]
        key = text.lower()
        if key in seen or key in _STOP:
            return
        if len(text) > 64:
            text = text[:64]
        seen.add(key)
        terms.append(text)

    add(submission.assignment.title if submission.assignment_id else None)
    if submission.github_url:
        parts = submission.github_url.rstrip("/").split("/")
        if len(parts) >= 2:
            add(parts[-1].replace("-", " "))
            add(parts[-1].replace("-", "_"), allow_multi=False)
            add(parts[-2], allow_multi=False)

    try:
        repo = submission.repository
    except ObjectDoesNotExist:
        repo = None
    if repo:
        profile = repo.project_profile or {}
        for stack in profile.get("stack") or []:
            add(str(stack))
        for entry in profile.get("entry_points") or []:
            add(str(entry).split("/")[-1], allow_multi=False)
        for item in profile.get("important_symbols") or []:
            if isinstance(item, dict):
                add(item.get("name"), allow_multi=False)
        for symbol in CodeSymbol.objects.filter(snapshot=repo).order_by("name")[:60]:
            add(symbol.name, allow_multi=False)
            if symbol.kind == "route":
                add(symbol.name)

    for chunk in SubmissionChunk.objects.filter(submission=submission).exclude(symbol="").order_by("chunk_index")[:40]:
        add(chunk.symbol, allow_multi=False)
        if chunk.path:
            add(chunk.path.split("/")[-1].rsplit(".", 1)[0], allow_multi=False)

    if session is not None:
        plan = session.question_plans.order_by("-created_at").first()
        if plan:
            for planned in plan.questions.order_by("order")[:20]:
                add(planned.concept, allow_multi=True)
                quote = (planned.metadata or {}).get("source_quote") or ""
                for token in _TOKEN_RE.findall(quote)[:8]:
                    if token[0].isupper() or "_" in token:
                        add(token, allow_multi=False)

    # Prefer identifier-like terms first
    ranked = sorted(terms, key=lambda t: (0 if ("_" in t or t[:1].isupper() or "/" in t) else 1, len(t)))
    return ranked[:limit]


def keyterms_for_session(session: VivaSession) -> list[str]:
    return build_stt_keyterms(session.submission, session=session)
