from __future__ import annotations

import zipfile
from io import BytesIO

from submissions.adapters.base import BaseSubmissionAdapter, ExtractedDocument
from submissions.text_sanitize import sanitize_json, sanitize_text

TEXT_EXTENSIONS = {".md", ".txt", ".py", ".java", ".c", ".cpp", ".h", ".js", ".ts", ".json", ".yaml", ".yml", ".rst"}


class ZipAdapter(BaseSubmissionAdapter):
    file_type = "zip"

    def extract(self, data: bytes, filename: str) -> ExtractedDocument:
        texts = []
        files_meta = []
        try:
            zf = zipfile.ZipFile(BytesIO(data))
        except zipfile.BadZipFile as exc:
            raise ValueError("This ZIP file could not be read. Please upload a valid ZIP archive.") from exc
        with zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                name = info.filename
                lower = name.lower()
                if not any(lower.endswith(ext) for ext in TEXT_EXTENSIONS):
                    files_meta.append({"path": name, "skipped": True})
                    continue
                try:
                    content = sanitize_text(zf.read(info).decode("utf-8", errors="replace"))
                except Exception:
                    continue
                texts.append(f"--- {name} ---\n{content}")
                files_meta.append({"path": name, "chars": len(content)})
        return ExtractedDocument(
            text="\n\n".join(texts),
            structure=sanitize_json({"files": files_meta}),
            source_ref=filename,
        )
