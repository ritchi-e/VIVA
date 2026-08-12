# AI Evaluation Framework

Synthetic evaluation lives in [`scripts/eval/`](../scripts/eval/).

## Dataset

[`dataset.json`](../scripts/eval/dataset.json) contains fictional cases across ML, software engineering, and data structures with:

- submission excerpts
- expected question grounding tokens
- retrieval chunks + relevant index
- sample answers + expected score bands

## Runner

```bash
cd backend
source .venv/bin/activate  # or use project venv
python ../scripts/eval/run_eval.py
```

Uses `AI_PROVIDER=mock` via Django test settings. **Does not fabricate paid-API results.**

## Metrics

| Area | Measure |
|------|---------|
| Question quality | Grounding heuristic (must-mention / "submission") |
| Retrieval | Hit@1 via cosine similarity of mock embeddings |
| Answer evaluation | Overall score within expected band |
| System | Latency, failure rate, estimated cost (0 for mock) |

## Latest results (mock provider)

See [`results.json`](../scripts/eval/results.json). Snapshot:

- cases: 3
- failure_count: 0
- failure_rate: 0.0
- estimated_cost_usd: 0.0

These numbers are **deterministic mock-provider results** and are not comparable to production OpenAI/Gemini quality.
