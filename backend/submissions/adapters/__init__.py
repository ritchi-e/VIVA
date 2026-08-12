from __future__ import annotations

from submissions.adapters.docx_adapter import DocxAdapter
from submissions.adapters.pdf import PdfAdapter
from submissions.adapters.pptx_adapter import PptxAdapter
from submissions.adapters.zip_adapter import ZipAdapter
from submissions.models import SubmissionFile

ADAPTERS = {
    SubmissionFile.FileType.PDF: PdfAdapter(),
    SubmissionFile.FileType.DOCX: DocxAdapter(),
    SubmissionFile.FileType.PPTX: PptxAdapter(),
    SubmissionFile.FileType.ZIP: ZipAdapter(),
}


def get_adapter(file_type: str):
    return ADAPTERS.get(file_type)
