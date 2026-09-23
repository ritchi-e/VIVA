from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ExtractedDocument:
    text: str
    structure: dict[str, Any]
    source_ref: str = ""


class BaseSubmissionAdapter:
    file_type: str = "other"
    extractor_version: str = "generic-v1"

    def extract(self, data: bytes, filename: str) -> ExtractedDocument:
        raise NotImplementedError
