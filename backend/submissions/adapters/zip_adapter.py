from __future__ import annotations

import zipfile
from io import BytesIO

from submissions.adapters.base import BaseSubmissionAdapter, ExtractedDocument

TEXT_EXTENSIONS = {".md", ".txt", ".py", ".java", ".c", ".cpp", ".h", ".js", ".ts", ".json", ".yaml", ".yml", ".rst"}


class ZipAdapter(BaseSubmissionAdapter):
    file_type = "zip"

    def extract(self, data: bytes, filename: str) -> ExtractedDocument:
        texts = []
        files_meta = []
        with zipfile.ZipFile(BytesIO(data)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                name = info.filename
                lower = name.lower()
                if not any(lower.endswith(ext) for ext in TEXT_EXTENSIONS):
                    files_meta.append({"path": name, "skipped": True})
                    continue
                try:
                    content = zf.read(info).decode("utf-8", errors="replace")
                except Exception:
                    continue
                texts.append(f"--- {name} ---\n{content}")
                files_meta.append({"path": name, "chars": len(content)})
        return ExtractedDocument(
            text="\n\n".join(texts),
            structure={"files": files_meta},
            source_ref=filename,
        )
