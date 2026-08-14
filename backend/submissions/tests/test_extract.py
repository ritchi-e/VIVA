import io
import zipfile

from django.test import SimpleTestCase, override_settings

from submissions.repository.classify import classify_file
from submissions.repository.extract import extract_zip_inventory
from submissions.repository.ignore import should_deny_path


def _zip_bytes(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        for path, content in files.items():
            zf.writestr(path, content)
    return buffer.getvalue()


class ClassifyAndIgnoreTests(SimpleTestCase):
    def test_classifies_source_docs_and_config(self):
        self.assertEqual(classify_file("src/model.py")[0], "source")
        self.assertEqual(classify_file("README.md")[0], "documentation")
        self.assertEqual(classify_file("requirements.txt")[0], "configuration")
        self.assertEqual(classify_file("tests/test_model.py")[0], "test")
        self.assertEqual(classify_file("data/train.csv")[0], "dataset")

    def test_denies_vendor_and_secrets(self):
        self.assertEqual(should_deny_path("node_modules/leftpad/index.js"), "ignored_directory")
        self.assertEqual(should_deny_path(".env"), "secret_or_local_file")
        self.assertEqual(should_deny_path("venv/lib/site.py"), "ignored_directory")
        self.assertEqual(should_deny_path("dist/app.min.js"), "ignored_directory")


class ExtractZipTests(SimpleTestCase):
    @override_settings(MAX_REPO_FILES=50, MAX_REPO_FILE_BYTES=50_000, MAX_EXTRACTED_CHARS=200_000)
    def test_strips_github_root_and_skips_unsafe_paths(self):
        archive = _zip_bytes(
            {
                "repo-sha/README.md": "# Demo project",
                "repo-sha/src/model.py": "def train_model():\n    return 1\n",
                "repo-sha/node_modules/pkg/index.js": "module.exports = 1",
                "repo-sha/../escape.py": "bad",
                "repo-sha/.env": "SECRET=1",
            }
        )
        files = extract_zip_inventory(archive)
        indexed = {item.path: item for item in files if item.indexed}
        self.assertIn("README.md", indexed)
        self.assertIn("src/model.py", indexed)
        skipped_reasons = {item.path: item.skip_reason for item in files if not item.indexed}
        self.assertTrue(any(reason == "ignored_directory" for reason in skipped_reasons.values()))
        self.assertTrue(any("env" in path or reason == "secret_or_local_file" for path, reason in skipped_reasons.items()))
        self.assertFalse(any(".." in item.path and item.indexed for item in files))
