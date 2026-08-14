from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field


@dataclass
class ParsedSymbol:
    name: str
    kind: str
    signature: str
    docstring: str
    start_line: int
    end_line: int
    body: str
    metadata: dict = field(default_factory=dict)


@dataclass
class ParsedImport:
    module: str
    names: list[str]
    start_line: int
    resolved: bool = False


@dataclass
class ParseResult:
    symbols: list[ParsedSymbol]
    imports: list[ParsedImport]
    language: str


_FN_PATTERNS = {
    "javascript": re.compile(
        r"^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)",
        re.M,
    ),
    "typescript": re.compile(
        r"^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)",
        re.M,
    ),
    "java": re.compile(
        r"^\s*(?:public|private|protected)?\s*(?:static\s+)?[\w.<>,\[\]]+\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{",
        re.M,
    ),
    "go": re.compile(r"^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)", re.M),
    "rust": re.compile(r"^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)", re.M),
    "ruby": re.compile(r"^\s*def\s+([A-Za-z0-9_?!]+)(?:\(([^)]*)\))?", re.M),
    "php": re.compile(r"function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)", re.M),
    "csharp": re.compile(
        r"^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?[\w.<>,\[\]]+\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{",
        re.M,
    ),
    "c": re.compile(r"^[\w\s\*]+\s+([A-Za-z0-9_]+)\s*\(([^;{]*)\)\s*\{", re.M),
    "cpp": re.compile(r"^[\w\s\*:<>]+\s+([A-Za-z0-9_]+)\s*\(([^;{]*)\)\s*\{", re.M),
}

_CLASS_PATTERNS = {
    "javascript": re.compile(r"^(?:export\s+)?class\s+([A-Za-z0-9_]+)", re.M),
    "typescript": re.compile(r"^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_]+)", re.M),
    "java": re.compile(r"^\s*(?:public\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_]+)", re.M),
    "csharp": re.compile(r"^\s*(?:public\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_]+)", re.M),
    "ruby": re.compile(r"^\s*class\s+([A-Za-z0-9_]+)", re.M),
    "php": re.compile(r"class\s+([A-Za-z0-9_]+)", re.M),
    "rust": re.compile(r"^(?:pub\s+)?struct\s+([A-Za-z0-9_]+)", re.M),
    "go": re.compile(r"^type\s+([A-Za-z0-9_]+)\s+struct", re.M),
}

_IMPORT_PATTERNS = {
    "javascript": re.compile(r"^\s*import\s+.+?\s+from\s+['\"]([^'\"]+)['\"]", re.M),
    "typescript": re.compile(r"^\s*import\s+.+?\s+from\s+['\"]([^'\"]+)['\"]", re.M),
    "go": re.compile(r'^\s*import\s+(?:\(\s*)?[^\n]*["\']([^"\']+)["\']', re.M),
    "java": re.compile(r"^\s*import\s+([\w.]+);", re.M),
    "rust": re.compile(r"^\s*use\s+([\w:]+)", re.M),
    "ruby": re.compile(r"^\s*require(?:_relative)?\s+['\"]([^'\"]+)['\"]", re.M),
    "php": re.compile(r"^\s*use\s+([\w\\]+);", re.M),
    "csharp": re.compile(r"^\s*using\s+([\w.]+);", re.M),
    "c": re.compile(r"^\s*#include\s+[<\"]([^>\"]+)[>\"]", re.M),
    "cpp": re.compile(r"^\s*#include\s+[<\"]([^>\"]+)[>\"]", re.M),
}

_ROUTE_PATTERNS = (
    re.compile(r"@(?:app|router|api)\.(?:get|post|put|patch|delete)\(\s*['\"]([^'\"]+)['\"]", re.I),
    re.compile(r"(?:app|router)\.(?:get|post|put|patch|delete)\(\s*['\"]([^'\"]+)['\"]", re.I),
    re.compile(r"@(?:Get|Post|Put|Patch|Delete)Mapping\(\s*['\"]([^'\"]+)['\"]"),
    re.compile(r"path\(\s*['\"]([^'\"]+)['\"]"),
)


def _line_of(text: str, index: int) -> int:
    return text[:index].count("\n") + 1


def _block_until(lines: list[str], start_idx: int, closer: str = "}") -> int:
    depth = 0
    started = False
    for i in range(start_idx, len(lines)):
        depth += lines[i].count("{") - lines[i].count("}")
        if "{" in lines[i]:
            started = True
        if started and depth <= 0:
            return i
    return min(start_idx + 40, len(lines) - 1)


def parse_python(source: str) -> ParseResult:
    symbols: list[ParsedSymbol] = []
    imports: list[ParsedImport] = []
    lines = source.splitlines()
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return ParseResult(symbols=[], imports=[], language="python")

    for node in tree.body:
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(ParsedImport(alias.name, [alias.asname or alias.name], node.lineno))
        elif isinstance(node, ast.ImportFrom) and node.module:
            names = [alias.name for alias in node.names]
            imports.append(ParsedImport(node.module, names, node.lineno))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            end = getattr(node, "end_lineno", node.lineno) or node.lineno
            args = ", ".join(a.arg for a in node.args.args)
            body = "\n".join(lines[node.lineno - 1 : end])
            symbols.append(
                ParsedSymbol(
                    name=node.name,
                    kind="function",
                    signature=f"def {node.name}({args})",
                    docstring=ast.get_docstring(node) or "",
                    start_line=node.lineno,
                    end_line=end,
                    body=body,
                    metadata={"decorators": [ast.unparse(d) for d in node.decorator_list] if hasattr(ast, "unparse") else []},
                )
            )
        elif isinstance(node, ast.ClassDef):
            end = getattr(node, "end_lineno", node.lineno) or node.lineno
            body = "\n".join(lines[node.lineno - 1 : end])
            symbols.append(
                ParsedSymbol(
                    name=node.name,
                    kind="class",
                    signature=f"class {node.name}",
                    docstring=ast.get_docstring(node) or "",
                    start_line=node.lineno,
                    end_line=end,
                    body=body,
                )
            )
            for child in node.body:
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    cend = getattr(child, "end_lineno", child.lineno) or child.lineno
                    cargs = ", ".join(a.arg for a in child.args.args)
                    symbols.append(
                        ParsedSymbol(
                            name=f"{node.name}.{child.name}",
                            kind="method",
                            signature=f"def {child.name}({cargs})",
                            docstring=ast.get_docstring(child) or "",
                            start_line=child.lineno,
                            end_line=cend,
                            body="\n".join(lines[child.lineno - 1 : cend]),
                        )
                    )

    _attach_routes(source, symbols)
    return ParseResult(symbols=symbols, imports=imports, language="python")


def _attach_routes(source: str, symbols: list[ParsedSymbol]) -> None:
    for pattern in _ROUTE_PATTERNS:
        for match in pattern.finditer(source):
            line = _line_of(source, match.start())
            symbols.append(
                ParsedSymbol(
                    name=match.group(1),
                    kind="route",
                    signature=match.group(0)[:240],
                    docstring="",
                    start_line=line,
                    end_line=line,
                    body=match.group(0),
                )
            )


def parse_with_regex(source: str, language: str) -> ParseResult:
    lines = source.splitlines() or [""]
    symbols: list[ParsedSymbol] = []
    imports: list[ParsedImport] = []
    fn_re = _FN_PATTERNS.get(language)
    class_re = _CLASS_PATTERNS.get(language)
    import_re = _IMPORT_PATTERNS.get(language)

    if class_re:
        for match in class_re.finditer(source):
            start = _line_of(source, match.start())
            end = _block_until(lines, start - 1) + 1
            name = match.group(1)
            symbols.append(
                ParsedSymbol(
                    name=name,
                    kind="class",
                    signature=match.group(0)[:240],
                    docstring="",
                    start_line=start,
                    end_line=end,
                    body="\n".join(lines[start - 1 : end]),
                )
            )
    if fn_re:
        for match in fn_re.finditer(source):
            start = _line_of(source, match.start())
            end = _block_until(lines, start - 1) + 1
            name = match.group(1)
            if language in {"java", "csharp"} and name in {"if", "for", "while", "switch", "catch"}:
                continue
            args = match.group(2) if match.lastindex and match.lastindex >= 2 else ""
            symbols.append(
                ParsedSymbol(
                    name=name,
                    kind="function",
                    signature=f"{name}({args.strip()})"[:240],
                    docstring="",
                    start_line=start,
                    end_line=end,
                    body="\n".join(lines[start - 1 : end]),
                )
            )
    if import_re:
        for match in import_re.finditer(source):
            module = match.group(1)
            imports.append(ParsedImport(module, [module.split(".")[-1].split("/")[-1]], _line_of(source, match.start())))

    _attach_routes(source, symbols)
    return ParseResult(symbols=symbols, imports=imports, language=language)


def parse_source(source: str, language: str) -> ParseResult:
    if language == "python":
        result = parse_python(source)
        if result.symbols or result.imports:
            return result
        return parse_with_regex(source, "python")
    if language in _FN_PATTERNS or language in _CLASS_PATTERNS:
        return parse_with_regex(source, language)
    return ParseResult(symbols=[], imports=[], language=language)
