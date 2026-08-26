from __future__ import annotations

import logging
import time
from decimal import Decimal
from typing import Any

from django.utils import timezone

from ai.models import AIRequest
from ai.providers import get_chat_provider, get_embedding_provider
from ai.providers.base import ChatMessage

logger = logging.getLogger(__name__)


COST_PER_1K = {
    # gpt-4o-mini: $0.15 / $0.60 per 1M tokens
    ("openai", "chat"): (Decimal("0.00015"), Decimal("0.0006")),
    # text-embedding-3-small: ~$0.02 per 1M tokens
    ("openai", "embedding"): (Decimal("0.00002"), Decimal("0")),
    ("gemini", "chat"): (Decimal("0.000075"), Decimal("0.0003")),
    ("gemini", "embedding"): (Decimal("0.00001"), Decimal("0")),
    ("mock", "chat"): (Decimal("0"), Decimal("0")),
    ("mock", "embedding"): (Decimal("0"), Decimal("0")),
}


class AIService:
    def __init__(self, organization=None, user=None):
        self.organization = organization
        self.user = user
        self.chat_provider = get_chat_provider()
        self.embedding_provider = get_embedding_provider()

    def _estimate_cost(self, provider: str, kind: str, input_tokens: int, output_tokens: int) -> Decimal:
        in_rate, out_rate = COST_PER_1K.get((provider, kind), (Decimal("0"), Decimal("0")))
        return (Decimal(input_tokens) / 1000) * in_rate + (Decimal(output_tokens) / 1000) * out_rate

    def _log(self, provider: str, model: str, request_type: str, input_tokens: int, output_tokens: int,
             latency_ms: int, success: bool, error_message: str = "", metadata: dict | None = None):
        AIRequest.objects.create(
            provider=provider,
            model=model,
            request_type=request_type,
            organization=self.organization,
            user=self.user,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=self._estimate_cost(provider, "chat" if "embed" not in request_type else "embedding",
                                                   input_tokens, output_tokens),
            latency_ms=latency_ms,
            success=success,
            error_message=error_message,
            metadata=metadata or {},
        )

    def chat(self, messages: list[dict[str, str]], **kwargs):
        start = time.monotonic()
        provider_name = type(self.chat_provider).__name__
        try:
            result = self.chat_provider.chat(
                [ChatMessage(**m) for m in messages],
                **kwargs,
            )
            self._log(provider_name, getattr(self.chat_provider, "model", "mock"), "chat",
                      result.input_tokens, result.output_tokens, int((time.monotonic() - start) * 1000), True)
            return result
        except Exception as exc:
            self._log(provider_name, "unknown", "chat", 0, 0, int((time.monotonic() - start) * 1000), False, str(exc))
            raise

    @staticmethod
    def _validate_structured(data: Any, schema: dict[str, Any]) -> list[str]:
        """Check required fields and score ranges. Returns list of issues."""
        if not isinstance(data, dict):
            return ["response is not a dict"]
        issues: list[str] = []
        for field in schema.get("required", []):
            if field not in data:
                issues.append(f"missing required field: {field}")
        props = schema.get("properties", {})
        for key, spec in props.items():
            if key not in data:
                continue
            if spec.get("type") == "number" and isinstance(data[key], (int, float)):
                if not (0 <= data[key] <= 10):
                    data[key] = max(0, min(10, data[key]))
        return issues

    def structured(self, messages: list[dict[str, str]], schema: dict[str, Any], **kwargs):
        start = time.monotonic()
        provider_name = type(self.chat_provider).__name__
        model_name = kwargs.get("model") or getattr(self.chat_provider, "model", "mock")
        max_attempts = 3
        last_exc: Exception | None = None
        for attempt in range(max_attempts):
            try:
                result = self.chat_provider.structured(
                    [ChatMessage(**m) for m in messages],
                    schema,
                    **kwargs,
                )
                issues = self._validate_structured(result.data, schema)
                if issues and attempt < max_attempts - 1:
                    logger.warning("Structured output validation failed (attempt %d): %s", attempt + 1, issues)
                    continue
                self._log(provider_name, model_name, "structured",
                          result.input_tokens, result.output_tokens, int((time.monotonic() - start) * 1000), True)
                return result
            except Exception as exc:
                last_exc = exc
                if attempt < max_attempts - 1:
                    logger.warning("Structured call failed (attempt %d), retrying: %s", attempt + 1, exc)
                    continue
                self._log(provider_name, "unknown", "structured", 0, 0, int((time.monotonic() - start) * 1000), False, str(exc))
                raise
        raise last_exc  # type: ignore[misc]

    def embed(self, texts: list[str]):
        start = time.monotonic()
        provider_name = type(self.embedding_provider).__name__
        try:
            result = self.embedding_provider.embed(texts)
            self._log(provider_name, getattr(self.embedding_provider, "model", "mock"), "embedding",
                      result.input_tokens, 0, int((time.monotonic() - start) * 1000), True)
            return result
        except Exception as exc:
            self._log(provider_name, "unknown", "embedding", 0, 0, int((time.monotonic() - start) * 1000), False, str(exc))
            raise
