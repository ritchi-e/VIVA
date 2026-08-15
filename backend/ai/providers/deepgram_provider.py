from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode

import httpx
from django.conf import settings

from ai.providers.base import STTProvider

logger = logging.getLogger(__name__)


class DeepgramSTTError(RuntimeError):
    pass


class DeepgramSTTProvider(STTProvider):
    """Deepgram Nova-3 speech-to-text with keyterm prompting for project vocabulary."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ):
        self.api_key = (api_key or getattr(settings, "DEEPGRAM_API_KEY", "") or "").strip()
        if not self.api_key:
            raise RuntimeError("DEEPGRAM_API_KEY is not configured")
        self.model = (model or getattr(settings, "DEEPGRAM_STT_MODEL", "nova-3") or "nova-3").strip()
        self.timeout = float(timeout or getattr(settings, "DEEPGRAM_STT_TIMEOUT", 45) or 45)

    def _listen_params(self, keyterms: list[str] | None = None) -> list[tuple[str, str]]:
        params: list[tuple[str, str]] = [
            ("model", self.model),
            ("smart_format", "true"),
            ("punctuate", "true"),
            ("utterances", "false"),
        ]
        for term in keyterms or []:
            cleaned = " ".join(str(term).split()).strip()
            if cleaned:
                params.append(("keyterm", cleaned[:80]))
        return params

    def transcribe(
        self,
        audio_bytes: bytes,
        content_type: str = "audio/webm",
        *,
        keyterms: list[str] | None = None,
    ) -> str:
        if not audio_bytes:
            return ""
        params = self._listen_params(keyterms)
        url = f"https://api.deepgram.com/v1/listen?{urlencode(params)}"
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": content_type or "application/octet-stream",
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(url, content=audio_bytes, headers=headers)
        except httpx.HTTPError as exc:
            raise DeepgramSTTError(f"Deepgram request failed: {exc}") from exc

        if response.status_code >= 400:
            detail = response.text[:400]
            logger.warning("Deepgram STT error status=%s body=%s", response.status_code, detail)
            raise DeepgramSTTError(f"Deepgram transcription failed ({response.status_code})")

        data = response.json()
        return _extract_transcript(data).strip()


def _extract_transcript(payload: dict[str, Any]) -> str:
    results = payload.get("results") or {}
    channels = results.get("channels") or []
    if not channels:
        return ""
    alternatives = (channels[0] or {}).get("alternatives") or []
    if not alternatives:
        return ""
    return str(alternatives[0].get("transcript") or "")
