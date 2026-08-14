from __future__ import annotations

from prometheus_client import Counter, Histogram

INGESTION_STAGE_DURATION = Histogram(
    "viva_ingestion_stage_duration_seconds",
    "Submission ingestion stage duration",
    ["stage"],
)
INGESTION_FAILURES = Counter(
    "viva_ingestion_failures_total",
    "Submission ingestion failures",
    ["reason"],
)
REPO_FILES = Counter(
    "viva_repo_files_total",
    "Repository files accepted or skipped",
    ["result", "reason"],
)
PARSE_FAILURES = Counter(
    "viva_repo_parse_failures_total",
    "Repository parse failures",
    ["language"],
)
EMBED_CACHE = Counter(
    "viva_embedding_cache_total",
    "Embedding cache hits and misses",
    ["result"],
)
RETRIEVAL_LATENCY = Histogram(
    "viva_retrieval_latency_seconds",
    "Chunk retrieval latency",
)
CITATION_VALIDATION = Counter(
    "viva_citation_validation_total",
    "Question citation validation outcomes",
    ["result"],
)
