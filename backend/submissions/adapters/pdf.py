from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader

from submissions.adapters.base import BaseSubmissionAdapter, ExtractedDocument


class PdfAdapter(BaseSubmissionAdapter):
    file_type = "pdf"

    def extract(self, data: bytes, filename: str) -> ExtractedDocument:
        reader = PdfReader(BytesIO(data))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            pages.append({"page": i + 1, "text": text})
        full_text = "\n\n".join(p["text"] for p in pages if p["text"])
        return ExtractedDocument(
            text=full_text,
            structure={"pages": pages, "page_count": len(reader.pages)},
            source_ref=filename,
        )
