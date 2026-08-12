#!/usr/bin/env python3
"""Synthetic AI evaluation runner for AI Viva (uses mock provider by default)."""

from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.test_settings")

import django

django.setup()

from ai.providers.mock import MockChatProvider, MockEmbeddingProvider
from ai.providers.base import ChatMessage

DATASET = Path(__file__).parent / "dataset.json"


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


def main():
    data = json.loads(DATASET.read_text())
    chat = MockChatProvider()
    emb = MockEmbeddingProvider()

    results = {
        "provider": "mock",
        "question_quality": [],
        "retrieval": [],
        "answer_evaluation": [],
        "system_performance": {},
    }

    t0 = time.monotonic()
    failures = 0

    for case in data["cases"]:
        # Question wording quality (grounding heuristic)
        start = time.monotonic()
        q = chat.structured(
            [
                ChatMessage(role="system", content="Generate a viva question"),
                ChatMessage(role="user", content=case["submission_excerpt"]),
            ],
            {"title": "question_wording"},
        )
        latency = (time.monotonic() - start) * 1000
        text = q.data.get("question_text", "")
        grounded = any(tok.lower() in text.lower() for tok in case.get("must_mention", [])) or "submission" in text.lower()
        results["question_quality"].append(
            {
                "id": case["id"],
                "grounded": grounded,
                "expected_category": case.get("expected_category"),
                "question": text,
                "latency_ms": round(latency, 2),
            }
        )
        if not grounded:
            failures += 1

        # Retrieval: embed query vs chunks
        vectors = emb.embed([case["query"]] + case["chunks"]).vectors
        qv, cvs = vectors[0], vectors[1:]
        ranked = sorted(((cosine(qv, cv), i) for i, cv in enumerate(cvs)), reverse=True)
        top = ranked[0][1] if ranked else -1
        hit = top == case["relevant_chunk_index"]
        results["retrieval"].append({"id": case["id"], "hit_at_1": hit, "top_index": top})
        if not hit:
            failures += 1

        # Answer evaluation consistency
        ev = chat.structured(
            [
                ChatMessage(role="system", content="Evaluate answer"),
                ChatMessage(role="user", content=f"Answer evaluation for: {case['sample_answer']}"),
            ],
            {"title": "answer_evaluation"},
        )
        overall = float(ev.data.get("overall", 0))
        expected_band = case.get("expected_score_band", [0, 10])
        in_band = expected_band[0] <= overall <= expected_band[1]
        results["answer_evaluation"].append(
            {
                "id": case["id"],
                "overall": overall,
                "in_expected_band": in_band,
                "requires_follow_up": ev.data.get("requires_follow_up"),
            }
        )
        if not in_band:
            failures += 1

    total_ms = (time.monotonic() - t0) * 1000
    n = max(len(data["cases"]), 1)
    results["system_performance"] = {
        "cases": n,
        "total_latency_ms": round(total_ms, 2),
        "avg_latency_ms": round(total_ms / n, 2),
        "failure_count": failures,
        "failure_rate": round(failures / (n * 3), 4),
        "estimated_cost_usd": 0.0,
        "notes": "Results from deterministic mock provider; not comparable to production LLM quality.",
    }

    out = Path(__file__).parent / "results.json"
    out.write_text(json.dumps(results, indent=2))
    print(json.dumps(results["system_performance"], indent=2))
    print(f"Wrote {out}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
