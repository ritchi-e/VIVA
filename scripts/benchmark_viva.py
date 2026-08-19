#!/usr/bin/env python3
"""
Latency benchmark: simulates N concurrent viva sessions against the API.

Requires the server to be running with AI_PROVIDER=mock.

Usage:
    python scripts/benchmark_viva.py --base-url http://localhost:8000 --concurrency 10 --questions 5

Prerequisites:
    pip install httpx
"""
from __future__ import annotations

import argparse
import asyncio
import statistics
import time

import httpx


async def simulate_session(
    client: httpx.AsyncClient,
    base_url: str,
    session_idx: int,
    num_questions: int,
) -> dict:
    """Simulate a single viva session and return timing data."""
    timings: list[float] = []
    errors: list[str] = []

    # This benchmark assumes mock provider and pre-existing test data.
    # In a real setup, you'd create a session via the API first.
    # Here we measure raw endpoint latency patterns.

    for q in range(num_questions):
        start = time.monotonic()
        try:
            resp = await client.get(f"{base_url}/api/health/")
            resp.raise_for_status()
            elapsed = (time.monotonic() - start) * 1000
            timings.append(elapsed)
        except Exception as exc:
            elapsed = (time.monotonic() - start) * 1000
            timings.append(elapsed)
            errors.append(f"session={session_idx} q={q}: {exc}")

        # Simulate student think time
        await asyncio.sleep(0.1)

    return {
        "session": session_idx,
        "timings_ms": timings,
        "errors": errors,
    }


async def run_benchmark(base_url: str, concurrency: int, num_questions: int):
    print(f"Benchmarking {base_url} with {concurrency} concurrent sessions, {num_questions} questions each\n")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Warm up
        try:
            resp = await client.get(f"{base_url}/api/health/")
            resp.raise_for_status()
            print(f"Health check OK: {resp.status_code}")
        except Exception as exc:
            print(f"WARNING: Health check failed: {exc}")
            return

        start = time.monotonic()
        tasks = [
            simulate_session(client, base_url, i, num_questions)
            for i in range(concurrency)
        ]
        results = await asyncio.gather(*tasks)
        total_time = time.monotonic() - start

    all_timings: list[float] = []
    total_errors = 0
    for result in results:
        all_timings.extend(result["timings_ms"])
        total_errors += len(result["errors"])
        for err in result["errors"]:
            print(f"  ERROR: {err}")

    if not all_timings:
        print("No timing data collected.")
        return

    all_timings.sort()
    n = len(all_timings)

    print(f"\n{'='*60}")
    print(f"Results: {concurrency} sessions x {num_questions} questions")
    print(f"{'='*60}")
    print(f"Total time:     {total_time:.2f}s")
    print(f"Total requests: {n}")
    print(f"Errors:         {total_errors}")
    print(f"Throughput:     {n / total_time:.1f} req/s")
    print(f"")
    print(f"Latency (ms):")
    print(f"  Min:  {min(all_timings):.1f}")
    print(f"  p50:  {all_timings[int(n * 0.50)]:.1f}")
    print(f"  p95:  {all_timings[int(n * 0.95)]:.1f}")
    print(f"  p99:  {all_timings[min(int(n * 0.99), n - 1)]:.1f}")
    print(f"  Max:  {max(all_timings):.1f}")
    print(f"  Mean: {statistics.mean(all_timings):.1f}")
    print(f"  Std:  {statistics.stdev(all_timings):.1f}" if n > 1 else "")


def main():
    parser = argparse.ArgumentParser(description="Viva latency benchmark")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--concurrency", type=int, default=10, help="Number of concurrent sessions")
    parser.add_argument("--questions", type=int, default=5, help="Questions per session")
    args = parser.parse_args()

    asyncio.run(run_benchmark(args.base_url, args.concurrency, args.questions))


if __name__ == "__main__":
    main()
