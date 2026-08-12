from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ChatMessage:
    role: str
    content: str


@dataclass
class ChatResult:
    content: str
    input_tokens: int = 0
    output_tokens: int = 0
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class EmbeddingResult:
    vectors: list[list[float]]
    input_tokens: int = 0
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class StructuredResult:
    data: dict[str, Any]
    input_tokens: int = 0
    output_tokens: int = 0
    raw: dict[str, Any] = field(default_factory=dict)


class ChatProvider(ABC):
    @abstractmethod
    def chat(self, messages: list[ChatMessage], **kwargs) -> ChatResult:
        raise NotImplementedError

    @abstractmethod
    def structured(self, messages: list[ChatMessage], schema: dict[str, Any], **kwargs) -> StructuredResult:
        raise NotImplementedError


class EmbeddingProvider(ABC):
    @abstractmethod
    def embed(self, texts: list[str], **kwargs) -> EmbeddingResult:
        raise NotImplementedError


class STTProvider(ABC):
    @abstractmethod
    def transcribe(self, audio_bytes: bytes, content_type: str = "audio/wav") -> str:
        raise NotImplementedError


class TTSProvider(ABC):
    @abstractmethod
    def synthesize(self, text: str) -> bytes:
        raise NotImplementedError
