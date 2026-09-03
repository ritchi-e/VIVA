from django.test import TestCase

from submissions.adapters.pdf import PdfAdapter
from submissions.pipeline import _user_facing_pipeline_error
from submissions.text_sanitize import sanitize_json, sanitize_text


class TextSanitizeTests(TestCase):
    def test_strips_nul_bytes(self):
        self.assertEqual(sanitize_text("hello\x00world"), "helloworld")

    def test_keeps_newlines_and_tabs(self):
        self.assertEqual(sanitize_text("a\nb\tc"), "a\nb\tc")

    def test_sanitizes_nested_json(self):
        payload = {"pages": [{"text": "bad\x00text"}], "ok": 1}
        self.assertEqual(sanitize_json(payload), {"pages": [{"text": "badtext"}], "ok": 1})

    def test_maps_nul_database_error(self):
        message = _user_facing_pipeline_error(
            Exception("A string literal cannot contain NUL (0x00) characters.")
        )
        self.assertIn("unreadable data", message)

    def test_pdf_rejects_non_pdf_bytes(self):
        with self.assertRaises(ValueError) as ctx:
            PdfAdapter().extract(b"not a pdf", "x.pdf")
        self.assertIn("valid PDF", str(ctx.exception))
