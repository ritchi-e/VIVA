from __future__ import annotations

import re

from submissions.models import SubmissionChunk
from submissions.repository.parse import ParsedSymbol

FALLBACK_SIZE = 1200
FALLBACK_OVERLAP = 120


def _line_span(text: str, start_char: int, end_char: int) -> tuple[int, int]:
    start_line = text[:start_char].count("\n") + 1
    end_line = text[:end_char].count("\n") + 1
    return start_line, max(end_line, start_line)


def semantic_units(path: str, source: str, language: str, symbols: list[ParsedSymbol]) -> list[dict]:
    units: list[dict] = []
    used_ranges: list[tuple[int, int]] = []
    lines = source.splitlines()
    for symbol in symbols:
        if symbol.kind not in {"function", "class", "method"}:
            continue
        start = max(1, symbol.start_line)
        end = max(start, symbol.end_line)
        body = symbol.body.strip() or "\n".join(lines[start - 1 : end])
        if len(body) < 20:
            continue
        used_ranges.append((start, end))
        units.append(
            {
                "path": path,
                "language": language,
                "symbol": symbol.name,
                "kind": symbol.kind if symbol.kind in {"function", "class", "method"} else "fallback",
                "start_line": start,
                "end_line": end,
                "content": f"File: {path}\n{symbol.signature}\n{body}"[:8000],
            }
        )

    # Fallback for leftover file regions / docs / config / unparsed source
    if not units:
        for piece, start, end in _fallback_windows(source):
            units.append(
                {
                    "path": path,
                    "language": language,
                    "symbol": "",
                    "kind": "document" if language in {"markdown", "rst", "text"} else "fallback",
                    "start_line": start,
                    "end_line": end,
                    "content": f"File: {path}\n{piece}"[:8000],
                }
            )
        return units

    covered = set()
    for start, end in used_ranges:
        covered.update(range(start, end + 1))
    leftover_lines = []
    for idx, line in enumerate(lines, start=1):
        if idx not in covered:
            leftover_lines.append((idx, line))
    if leftover_lines and len("\n".join(l for _, l in leftover_lines)) > 240:
        text = "\n".join(l for _, l in leftover_lines)
        start = leftover_lines[0][0]
        end = leftover_lines[-1][0]
        units.append(
            {
                "path": path,
                "language": language,
                "symbol": "",
                "kind": "fallback",
                "start_line": start,
                "end_line": end,
                "content": f"File: {path}\n{text}"[:4000],
            }
        )
    return units


def _fallback_windows(source: str) -> list[tuple[str, int, int]]:
    text = source.replace("\r\n", "\n")
    if not text.strip():
        return []
    windows = []
    start = 0
    while start < len(text):
        end = min(len(text), start + FALLBACK_SIZE)
        piece = text[start:end]
        start_line, end_line = _line_span(text, start, end)
        windows.append((piece, start_line, end_line))
        if end >= len(text):
            break
        start = max(0, end - FALLBACK_OVERLAP)
    return windows


def source_ref_for(path: str, start_line: int | None, end_line: int | None) -> str:
    if start_line and end_line:
        if start_line == end_line:
            return f"{path}:{start_line}"
        return f"{path}:{start_line}-{end_line}"
    return path
