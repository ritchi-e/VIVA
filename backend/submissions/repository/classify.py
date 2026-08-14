from __future__ import annotations

import os

SOURCE_EXTENSIONS = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".kt": "kotlin",
    ".c": "c",
    ".cc": "cpp",
    ".cpp": "cpp",
    ".cxx": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".cs": "csharp",
    ".swift": "swift",
    ".sql": "sql",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "css",
    ".ipynb": "notebook",
    ".r": "r",
    ".scala": "scala",
}

DOC_EXTENSIONS = {".md": "markdown", ".rst": "rst", ".txt": "text", ".adoc": "asciidoc"}
CONFIG_NAMES = {
    "requirements.txt",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "pipfile",
    "package.json",
    "tsconfig.json",
    "jsconfig.json",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "makefile",
    "cargo.toml",
    "go.mod",
    "go.sum",
    "gemfile",
    "composer.json",
    ".env.example",
    "env.example",
    "manage.py",
    "settings.py",
    "next.config.js",
    "vite.config.ts",
    "vite.config.js",
    "webpack.config.js",
}
CONFIG_EXTENSIONS = {".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf"}
DATASET_EXTENSIONS = {".csv", ".tsv", ".parquet", ".feather", ".npy", ".npz", ".h5", ".hdf5", ".pkl", ".pickle"}
TEST_DIR_MARKERS = {"test", "tests", "spec", "specs", "__tests__", "testing"}
GENERATED_DIR_MARKERS = {"generated", "gen", "migrations"}


def classify_file(path: str) -> tuple[str, str]:
    """Return (category, language) for a repository-relative path."""
    rel = path.replace("\\", "/")
    name = os.path.basename(rel)
    lower_name = name.lower()
    parts = [p.lower() for p in rel.split("/") if p]
    ext = os.path.splitext(lower_name)[1]

    if ext in DATASET_EXTENSIONS:
        return "dataset", ext.lstrip(".")
    if lower_name in CONFIG_NAMES or ext in CONFIG_EXTENSIONS:
        return "configuration", SOURCE_EXTENSIONS.get(ext, "config")
    if ext in DOC_EXTENSIONS or lower_name.startswith("readme"):
        return "documentation", DOC_EXTENSIONS.get(ext, "markdown")
    if any(part in TEST_DIR_MARKERS for part in parts) or lower_name.startswith("test_"):
        language = SOURCE_EXTENSIONS.get(ext, "")
        return "test", language
    if any(part in GENERATED_DIR_MARKERS for part in parts[:-1]):
        return "generated", SOURCE_EXTENSIONS.get(ext, "")
    if ext in SOURCE_EXTENSIONS:
        return "source", SOURCE_EXTENSIONS[ext]
    if lower_name in {"license", "licence", "copying"}:
        return "documentation", "text"
    return "unsupported", ""


def is_probably_binary(data: bytes) -> bool:
    if not data:
        return False
    sample = data[:4096]
    if b"\x00" in sample:
        return True
    # High ratio of non-text bytes
    textish = sum(32 <= b <= 126 or b in (9, 10, 13) for b in sample)
    return textish / max(len(sample), 1) < 0.75
