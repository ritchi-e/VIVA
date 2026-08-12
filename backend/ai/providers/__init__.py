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
    return MockSTTProvider()


def get_tts_provider() -> TTSProvider:
    provider = (settings.AI_PROVIDER or "mock").lower().strip()
    if provider == "openai":
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("AI_PROVIDER=openai but OPENAI_API_KEY is not set")
        from ai.providers.openai_provider import OpenAITTSProvider

        return OpenAITTSProvider()
    return MockTTSProvider()
