from __future__ import annotations

import logging
from io import BytesIO

from pypdf import PdfReader

from submissions.adapters.base import BaseSubmissionAdapter, ExtractedDocument
from submissions.text_sanitize import sanitize_json, sanitize_text

logger = logging.getLogger(__name__)


class PdfAdapter(BaseSubmissionAdapter):
    file_type = "pdf"

    def extract(self, data: bytes, filename: str) -> ExtractedDocument:
        if not data or not data.lstrip().startswith(b"%PDF"):
            raise ValueError("This file does not look like a valid PDF.")
        try:
            reader = PdfReader(BytesIO(data), strict=False)
        except Exception as exc:
            logger.warning("PDF open failed for %s: %s", filename, exc)
            raise ValueError("This PDF could not be read. Try exporting it again as a PDF.") from exc

        if getattr(reader, "is_encrypted", False):
            try:
                reader.decrypt("")
            except Exception as exc:
                raise ValueError("This PDF is password-protected and cannot be processed.") from exc

        pages = []
        for i, page in enumerate(reader.pages):
            try:
                text = sanitize_text(page.extract_text() or "")
            except Exception:
                logger.warning("Skipping unreadable PDF page %s in %s", i + 1, filename, exc_info=True)
                text = ""
            pages.append({"page": i + 1, "text": text})
        full_text = "\n\n".join(p["text"] for p in pages if p["text"])
        if not full_text.strip():
            raise ValueError(
                "No readable text was found in this PDF. If it is a scanned image, export a text PDF and try again."
            )
        return ExtractedDocument(
            text=full_text,
            structure=sanitize_json({"pages": pages, "page_count": len(reader.pages)}),
            source_ref=filename,
        )
