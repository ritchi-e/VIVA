"""Rumik silk Mulberry TTS — https://docs.rumik.ai/mulberry"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from django.conf import settings

from ai.providers.base import TTSProvider

logger = logging.getLogger(__name__)

RUMIK_TTS_URL = "https://silk-api.rumik.ai/v1/tts"

# Fixed examiner descriptions (English oral viva).
EXAMINER_DESCRIPTIONS: dict[str, str] = {
    "siya": (
        "a clear female examiner voice in her 30s, calm professional tone, "
        "measured conversational pacing, neutral register, like a university oral examiner"
    ),
    "noah": (
        "a clear male examiner voice in his 30s, calm professional tone, "
        "measured conversational pacing, neutral register, like a university oral examiner"
    ),
}

ALLOWED_SPEAKERS = frozenset(EXAMINER_DESCRIPTIONS.keys())


class RumikTTSProvider(TTSProvider):
    """Mulberry TTS via Rumik silk API. Returns 24 kHz mono WAV bytes."""

    def __init__(self):
        self.api_key = (getattr(settings, "RUMIK_API_KEY", "") or "").strip()
        if not self.api_key:
            raise RuntimeError("RUMIK_API_KEY is not set")
        self.model = getattr(settings, "RUMIK_TTS_MODEL", "mulberry") or "mulberry"
        self.default_speaker = (
            getattr(settings, "RUMIK_TTS_DEFAULT_SPEAKER", "siya") or "siya"
        ).lower()
        self.timeout = float(getattr(settings, "RUMIK_TTS_TIMEOUT", 45) or 45)

    def synthesize(self, text: str, **kwargs: Any) -> bytes:
        cleaned = (text or "").strip()
        if not cleaned:
            raise ValueError("text is required for TTS")
        # Mulberry limit is 2000 characters.
        cleaned = cleaned[:2000]

        speaker = str(kwargs.get("speaker") or self.default_speaker).lower().strip()
        if speaker not in ALLOWED_SPEAKERS:
            speaker = self.default_speaker if self.default_speaker in ALLOWED_SPEAKERS else "siya"

        description = EXAMINER_DESCRIPTIONS[speaker]
        payload = {
            "model": self.model,
            "text": cleaned,
            "description": description,
            "speaker": speaker,
            # Keep timbre stable across questions in one viva.
            "temperature": 0.35,
            "top_p": 0.9,
            "repetition_penalty": 1.1,
            "max_new_tokens": int(kwargs.get("max_new_tokens") or 4096),
        }

        try:
            response = httpx.post(
                RUMIK_TTS_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "Accept": "audio/wav",
                },
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = (exc.response.text or "")[:300]
            logger.error("Rumik TTS HTTP %s: %s", exc.response.status_code, detail)
            raise RuntimeError(f"Rumik TTS failed ({exc.response.status_code}): {detail}") from exc
        except httpx.HTTPError as exc:
            logger.exception("Rumik TTS request failed")
            raise RuntimeError(f"Rumik TTS request failed: {exc}") from exc

        audio = response.content
        if not audio:
            raise RuntimeError("Rumik TTS returned empty audio")
        return audio
