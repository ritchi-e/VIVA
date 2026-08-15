from django.conf import settings

from ai.providers.base import ChatProvider, EmbeddingProvider, STTProvider, TTSProvider
from ai.providers.mock import MockChatProvider, MockEmbeddingProvider, MockSTTProvider, MockTTSProvider


def get_chat_provider() -> ChatProvider:
    provider = (settings.AI_PROVIDER or "mock").lower().strip()
    if provider == "openai":
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("AI_PROVIDER=openai but OPENAI_API_KEY is not set")
        from ai.providers.openai_provider import OpenAIChatProvider

        return OpenAIChatProvider()
    if provider == "gemini":
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("AI_PROVIDER=gemini but GEMINI_API_KEY is not set")
        from ai.providers.gemini_provider import GeminiChatProvider

        return GeminiChatProvider()
    return MockChatProvider()


def get_embedding_provider() -> EmbeddingProvider:
    provider = (settings.AI_PROVIDER or "mock").lower().strip()
    if provider == "openai":
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("AI_PROVIDER=openai but OPENAI_API_KEY is not set")
        from ai.providers.openai_provider import OpenAIEmbeddingProvider

        return OpenAIEmbeddingProvider()
    if provider == "gemini":
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("AI_PROVIDER=gemini but GEMINI_API_KEY is not set")
        from ai.providers.gemini_provider import GeminiEmbeddingProvider

        return GeminiEmbeddingProvider()
    return MockEmbeddingProvider()


def get_stt_provider() -> STTProvider:
    explicit = (getattr(settings, "STT_PROVIDER", "") or "").lower().strip()
    deepgram_key = (getattr(settings, "DEEPGRAM_API_KEY", "") or "").strip()

    use_deepgram = explicit == "deepgram" or (explicit in ("", "auto") and bool(deepgram_key))
    if use_deepgram:
        if not deepgram_key:
            raise RuntimeError("STT_PROVIDER=deepgram but DEEPGRAM_API_KEY is not set")
        from ai.providers.deepgram_provider import DeepgramSTTProvider

        return DeepgramSTTProvider()

    if explicit == "mock":
        return MockSTTProvider()

    return MockSTTProvider()


def get_tts_provider() -> TTSProvider:
    """Prefer Rumik Mulberry when RUMIK_API_KEY is set (or TTS_PROVIDER=rumik)."""
    explicit = (getattr(settings, "TTS_PROVIDER", "") or "").lower().strip()
    rumik_key = (getattr(settings, "RUMIK_API_KEY", "") or "").strip()

    use_rumik = explicit == "rumik" or (explicit in ("", "auto") and bool(rumik_key))
    if use_rumik:
        if not rumik_key:
            raise RuntimeError("TTS_PROVIDER=rumik but RUMIK_API_KEY is not set")
        from ai.providers.rumik_provider import RumikTTSProvider

        return RumikTTSProvider()

    if explicit == "openai" or (
        explicit in ("", "auto") and (settings.AI_PROVIDER or "").lower().strip() == "openai"
    ):
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OpenAI TTS requested but OPENAI_API_KEY is not set")
        from ai.providers.openai_provider import OpenAITTSProvider

        return OpenAITTSProvider()

    return MockTTSProvider()
