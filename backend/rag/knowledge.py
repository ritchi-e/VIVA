from __future__ import annotations

from typing import Any

from ai.service import AIService
from orgs.models import Organization
from rag.models import KnowledgeNode
from submissions.models import Submission

KNOWLEDGE_SCHEMA = {
    "title": "knowledge_extraction",
    "type": "object",
    "properties": {
        "problem": {"type": "string"},
        "objectives": {"type": "array", "items": {"type": "string"}},
        "methodology": {"type": "object"},
        "implementation": {"type": "object"},
        "results": {"type": "object"},
        "conclusions": {"type": "array", "items": {"type": "string"}},
        "limitations": {"type": "array", "items": {"type": "string"}},
        "claims": {"type": "array", "items": {"type": "string"}},
        "terms": {"type": "array", "items": {"type": "string"}},
    },
}


def _create_nodes(submission: Submission, node_type: str, items: list[Any], parent=None):
    created = []
    for item in items:
        if isinstance(item, str):
            title, content = item[:512], item
        elif isinstance(item, dict):
            title = str(item.get("title") or item.get("name") or node_type)[:512]
            content = str(item.get("content") or item)
        else:
            title, content = str(item)[:512], str(item)
        node = KnowledgeNode.objects.create(
            submission=submission,
            node_type=node_type,
            title=title,
            content=content,
            parent=parent,
        )
        created.append(node)
    return created


def build_knowledge_nodes(submission: Submission, organization: Organization) -> dict[str, Any]:
    submission.knowledge_nodes.all().delete()
    texts = []
    for sf in submission.files.all():
        if sf.extracted_text:
            texts.append(sf.extracted_text[:8000])
    if submission.github_url:
        texts.append(f"GitHub repository: {submission.github_url}")
    corpus = "\n\n".join(texts)[:24000]
    ai = AIService(organization=organization, user=submission.student)
    result = ai.structured(
        [
            {
                "role": "system",
                "content": (
                    "Extract structured knowledge from the student submission text. "
                    "Return a JSON instance with fields like problem, objectives, methodology — "
                    "not the schema definition itself."
                ),
            },
            {"role": "user", "content": corpus or "No text extracted."},
        ],
        KNOWLEDGE_SCHEMA,
    )
    data = result.data if isinstance(result.data, dict) else {}
    mapping = {
        "problem": KnowledgeNode.NodeType.PROBLEM,
        "objectives": KnowledgeNode.NodeType.OBJECTIVE,
        "conclusions": KnowledgeNode.NodeType.CONCLUSION,
        "limitations": KnowledgeNode.NodeType.LIMITATION,
        "claims": KnowledgeNode.NodeType.CLAIM,
        "terms": KnowledgeNode.NodeType.TERM,
    }
    for key, node_type in mapping.items():
        val = data.get(key)
        if isinstance(val, list):
            _create_nodes(submission, node_type, val)
        elif isinstance(val, str) and val:
            _create_nodes(submission, node_type, [val])
    for section_key, node_type in (
        ("methodology", KnowledgeNode.NodeType.METHODOLOGY),
        ("implementation", KnowledgeNode.NodeType.IMPLEMENTATION),
        ("results", KnowledgeNode.NodeType.RESULT),
    ):
        section = data.get(section_key)
        if isinstance(section, dict):
            _create_nodes(submission, node_type, [section])
    return data
