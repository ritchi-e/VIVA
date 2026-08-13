from __future__ import annotations

import hashlib
import json
import math
import re
from typing import Any

from django.conf import settings

from ai.providers.base import (
    ChatMessage,
    ChatProvider,
    ChatResult,
    EmbeddingProvider,
    EmbeddingResult,
    StructuredResult,
    STTProvider,
    TTSProvider,
)


def _deterministic_vector(text: str, dims: int = 1536) -> list[float]:
    """Hash-based embedding with token mixing so similar texts are closer."""
    values = [0.0] * dims
    tokens = [t.lower() for t in re.findall(r"[a-zA-Z0-9_]+", text) if t]
    if not tokens:
        tokens = ["empty"]
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        for i in range(dims):
            values[i] += ((digest[i % len(digest)] / 255.0) * 2 - 1) / len(tokens)
    # Mild bias from full-text hash for uniqueness
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    for i in range(dims):
        values[i] += 0.05 * ((digest[i % len(digest)] / 255.0) * 2 - 1)
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


class MockChatProvider(ChatProvider):
    def chat(self, messages: list[ChatMessage], **kwargs) -> ChatResult:
        user_content = next((m.content for m in reversed(messages) if m.role == "user"), "")
        reply = (
            "Based on your submission, please explain the key design decisions you made "
            f"and how they relate to the stated objectives. (mock response to: {user_content[:120]})"
        )
        return ChatResult(content=reply, input_tokens=len(user_content.split()), output_tokens=len(reply.split()))

    def structured(self, messages: list[ChatMessage], schema: dict[str, Any], **kwargs) -> StructuredResult:
        user_content = next((m.content for m in reversed(messages) if m.role == "user"), "")
        schema_title = schema.get("title") or schema.get("name") or "result"
        title = schema_title.lower()
        if "evaluation" in title:
            answer_part = user_content.split("Answer:", 1)[-1].strip() if "Answer:" in user_content else user_content
            # Only probe further on very short answers — otherwise advance to the next planned question.
            requires_follow_up = len(answer_part.split()) < 18
            data = {
                "conceptual_accuracy": 7.5,
                "evidence_support": 7.0,
                "depth": 6.5 if requires_follow_up else 7.5,
                "relevance": 8.0,
                "overall": 6.0 if requires_follow_up else 7.5,
                "requires_follow_up": requires_follow_up,
                "explanation": (
                    "Mock evaluation: answer is brief; a follow-up is warranted."
                    if requires_follow_up
                    else "Mock evaluation: answer demonstrates adequate understanding to proceed."
                ),
                "evidence_refs": [],
            }
        elif "knowledge" in title or "extract" in user_content.lower():
            data = {
                "problem": "Identify the core problem addressed in the submission.",
                "objectives": ["Demonstrate understanding of the chosen approach"],
                "methodology": {"methods": ["Described approach"], "algorithms": [], "dataset": "", "preprocessing": []},
                "implementation": {"architecture": "Modular components", "components": [], "dependencies": []},
                "results": {"metrics": [], "findings": ["Results discussed in submission"]},
                "conclusions": ["Conclusions summarized"],
                "limitations": ["Limitations noted where present"],
                "claims": [],
                "terms": [],
            }
        elif "question_plan" in title or title == "question_plan":
            data = _mock_question_plan(user_content, budget=8)
        elif "batch_question_wording" in title:
            data = _mock_batch_wording(user_content)
        elif "batch_answer_evaluation" in title:
            data = _mock_batch_evaluation(user_content)
        elif "viva_live_turn" in title or "viva_next_turn" in title or "next_turn" in title:
            data = _mock_next_turn(user_content)
        elif "follow_up" in title:
            data = _mock_follow_up_wording(user_content)
        elif "question" in title:
            data = _mock_question_wording(user_content)
        elif "assessment" in title:
            data = {
                "overall_score": 72.0,
                "strengths": ["Clear problem framing", "Reasonable methodology"],
                "weaknesses": ["Limited critical analysis of alternatives"],
                "evidence_summary": "Student demonstrated moderate understanding across criteria.",
                "areas_requiring_review": ["Results interpretation"],
                "unanswered_areas": ["Scalability trade-offs"],
                "recommended_followups": ["Ask about failure modes"],
                "criteria": [
                    {"name": "Conceptual Understanding", "ai_score": 7.5, "explanation": "Solid concepts"},
                    {"name": "Methodology", "ai_score": 7.0, "explanation": "Adequate method rationale"},
                    {"name": "Implementation", "ai_score": 7.2, "explanation": "Implementation discussed"},
                    {"name": "Results Interpretation", "ai_score": 6.0, "explanation": "Needs deeper analysis"},
                    {"name": "Critical Thinking", "ai_score": 6.5, "explanation": "Partial critique"},
                    {"name": "Communication", "ai_score": 7.8, "explanation": "Clear responses"},
                ],
            }
        else:
            data = {"result": "mock", "input_preview": user_content[:200]}
        return StructuredResult(
            data=data,
            input_tokens=len(user_content.split()),
            output_tokens=50,
            raw={"schema": schema_title, "provider": "mock"},
        )


class MockEmbeddingProvider(EmbeddingProvider):
    def embed(self, texts: list[str], **kwargs) -> EmbeddingResult:
        dims = getattr(settings, "EMBEDDING_DIMENSIONS", 1536)
        return EmbeddingResult(
            vectors=[_deterministic_vector(t, dims) for t in texts],
            input_tokens=sum(len(t.split()) for t in texts),
        )


class MockSTTProvider(STTProvider):
    def transcribe(self, audio_bytes: bytes, content_type: str = "audio/wav") -> str:
        return "Mock transcription of student answer."


class MockTTSProvider(TTSProvider):
    def synthesize(self, text: str, **kwargs) -> bytes:
        return f"MOCK_AUDIO:{text}".encode("utf-8")



def extract_json_block(text: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("No JSON object found in model response")
    return normalize_structured_data(json.loads(match.group(0)))


def normalize_structured_data(data: Any) -> dict[str, Any]:
    """Unwrap LLM responses that echo the JSON Schema instead of an instance.

    Models sometimes return::

        {"type": "object", "title": "...", "properties": {"questions": [...], ...}}

    when callers expect::

        {"questions": [...], ...}
    """
    if not isinstance(data, dict):
        return {}
    if data.get("type") != "object" or "properties" not in data:
        return data
    # Instance payloads can still include a "type" field; only unwrap schema echoes.
    props = data.get("properties")
    if not isinstance(props, dict):
        return data
    # Heuristic: schema echoes keep title/properties and lack top-level domain keys.
    schema_meta = {"type", "title", "properties", "required", "description", "$schema", "items"}
    top_level_domain = set(data.keys()) - schema_meta
    if top_level_domain & set(props.keys()):
        return data

    unwrapped: dict[str, Any] = {}
    for key, val in props.items():
        if isinstance(val, dict) and isinstance(val.get("items"), list):
            unwrapped[key] = val["items"]
        elif isinstance(val, dict) and set(val.keys()) <= {
            "type",
            "items",
            "properties",
            "description",
            "required",
            "title",
        }:
            if isinstance(val.get("items"), list):
                unwrapped[key] = val["items"]
            elif val.get("type") == "object":
                nested = normalize_structured_data(val)
                unwrapped[key] = nested if nested else {}
            elif val.get("type") == "array":
                unwrapped[key] = []
            else:
                unwrapped[key] = None
        else:
            unwrapped[key] = val
    return unwrapped if unwrapped else data


def _extract_excerpts(user_content: str) -> str:
    if "## Submission excerpts" in user_content:
        return user_content.split("## Submission excerpts", 1)[1].strip()
    return user_content


def _parse_excerpt_blocks(excerpts: str) -> list[dict[str, str]]:
    blocks: list[dict[str, str]] = []
    for match in re.finditer(
        r"\[([^\]]+)\]\s*\n(.*?)(?=\n\[|\Z)",
        excerpts,
        re.S,
    ):
        ref = match.group(1).strip()
        if ref.startswith("Excerpt "):
            continue
        blocks.append(
            {
                "chunk_id": ref.lower().replace(" ", "-"),
                "source_ref": ref,
                "content": match.group(2).strip(),
            }
        )
    if blocks:
        return blocks
    for match in re.finditer(
        r"\[Excerpt \d+ \| id=([^\|]+) \| ref=([^\|]*)\|[^\]]*\]\s*\n(.*?)(?=\[Excerpt \d+ \| id=|\Z)",
        excerpts,
        re.S,
    ):
        blocks.append(
            {
                "chunk_id": match.group(1).strip(),
                "source_ref": match.group(2).strip(),
                "content": match.group(3).strip(),
            }
        )
    if blocks:
        return blocks
    # Conversation format: [source_ref]\ncontent
    for match in re.finditer(r"\[([^\]]+)\]\s*\n(.*?)(?=\[[^\]]+\]\s*\n|\Z)", excerpts, re.S):
        ref = match.group(1).strip()
        if ref.startswith("Excerpt "):
            continue
        blocks.append(
            {
                "chunk_id": ref.lower().replace(" ", "-"),
                "source_ref": ref,
                "content": match.group(2).strip(),
            }
        )
    if blocks:
        return blocks
    # Fallback: markdown sections
    for section_match in re.finditer(r"##?\s*([A-Za-z][^\n]*)\n(.*?)(?=\n##|\Z)", excerpts, re.S):
        blocks.append(
            {
                "chunk_id": section_match.group(1).strip().lower().replace(" ", "-"),
                "source_ref": section_match.group(1).strip(),
                "content": section_match.group(2).strip(),
            }
        )
    if blocks:
        return blocks
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", excerpts) if len(p.strip()) > 40]
    for idx, paragraph in enumerate(paragraphs[:10]):
        blocks.append({"chunk_id": f"p-{idx}", "source_ref": f"paragraph-{idx + 1}", "content": paragraph})
    return blocks


def _first_sentence(text: str, limit: int = 140) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return "your submission"
    sentence = re.split(r"(?<=[.!?])\s+", cleaned)[0]
    return sentence[:limit].strip(" .")


def _mock_question_plan(user_content: str, budget: int = 8) -> dict[str, Any]:
    excerpts = _extract_excerpts(user_content)
    blocks = _parse_excerpt_blocks(excerpts)
    budget_match = re.search(r"Plan exactly (\d+)", user_content)
    if budget_match:
        budget = int(budget_match.group(1))

    type_cycle = [
        "conceptual",
        "methodology",
        "implementation",
        "results",
        "critical_thinking",
        "defense",
        "limitations",
        "application",
        "submission_specific",
    ]
    rubric_names = re.findall(r"- ([^\(]+) \(", user_content)
    outcome_codes = re.findall(r"- (LO\d+):", user_content)

    questions = []
    for idx in range(budget):
        block = blocks[idx % len(blocks)] if blocks else {"content": excerpts[:400], "chunk_id": "excerpt-1", "source_ref": "submission"}
        content = block.get("content", "")
        concept = _first_sentence(content)
        section = block.get("source_ref") or f"section-{idx + 1}"
        qtype = type_cycle[idx % len(type_cycle)]
        questions.append(
            {
                "question_type": qtype,
                "difficulty": "medium",
                "concept": concept,
                "purpose": f"Assess understanding of {section} from the student's submission",
                "expected_evidence": f"Specific references to content about {section}",
                "source_artifact": "submission",
                "source_ref": block.get("chunk_id") or section,
                "source_chunk_id": block.get("chunk_id") or "",
                "rubric_criterion_name": rubric_names[idx % len(rubric_names)].strip() if rubric_names else "",
                "learning_outcome_code": outcome_codes[idx % len(outcome_codes)] if outcome_codes else "",
            }
        )

    return {"questions": questions, "coverage": {"planned": len(questions), "grounded_in_submission": bool(blocks)}}


def _mock_question_wording(user_content: str) -> dict[str, Any]:
    qtype = "conceptual"
    concept = "your approach"
    purpose = "understanding"
    m_type = re.search(r"Type:\s*([^\n]+)", user_content, re.I)
    m_concept = re.search(r"Concept:\s*([^\n]+)", user_content, re.I)
    m_purpose = re.search(r"Purpose:\s*([^\n]+)", user_content, re.I)
    if m_type:
        qtype = m_type.group(1).strip()
    if m_concept:
        concept = m_concept.group(1).strip()
    if m_purpose:
        purpose = m_purpose.group(1).strip()

    excerpts = _extract_excerpts(user_content)
    blocks = _parse_excerpt_blocks(excerpts)
    snippet = _first_sentence(blocks[0]["content"]) if blocks else concept

    templates = {
        "conceptual": f"In your submission you discuss '{snippet}'. What is the core idea behind this, and why does it matter for your project?",
        "methodology": f"You wrote about '{snippet}'. Why did you choose this approach instead of a reasonable alternative?",
        "implementation": f"Walk me through how you implemented the idea described in '{snippet}' and what trade-offs you considered.",
        "results": f"Your submission mentions '{snippet}'. How do your results support the claims you make there?",
        "critical_thinking": f"What is the strongest counterargument to your reasoning about '{snippet}'?",
        "defense": f"Defend your decision related to '{snippet}' against a skeptical examiner.",
        "limitations": f"What limitations or risks around '{snippet}' should we be aware of?",
        "application": f"If the constraints of your project changed, how would '{snippet}' influence your revised approach?",
        "counterfactual": f"If the approach behind '{snippet}' had failed, what would you have tried next?",
        "submission_specific": f"Point to the part of your submission about '{snippet}' and explain it in your own words.",
    }
    question_text = templates.get(
        qtype,
        f"Explain how '{concept}' appears in your submission and why it supports your overall goal ({purpose}).",
    )
    return {
        "question_text": question_text,
        "rationale": f"Grounded mock wording using submission excerpt about {snippet}.",
    }


def _mock_batch_wording(user_content: str) -> dict[str, Any]:
    planned_ids = re.findall(r"['\"]planned_id['\"]\s*:\s*['\"]([^'\"]+)['\"]", user_content)
    if not planned_ids:
        planned_ids = re.findall(r"planned_id['\"]?:\s*['\"]?([0-9a-f-]{8,})", user_content, re.I)
    questions = []
    for idx, planned_id in enumerate(planned_ids or ["mock-1"]):
        questions.append(
            {
                "planned_id": planned_id,
                "question_text": (
                    f"Based on your submission, explain decision #{idx + 1} in your own words "
                    f"and why you made that choice."
                ),
                "rationale": "Mock batch wording",
            }
        )
    return {"questions": questions}


def _mock_batch_evaluation(user_content: str) -> dict[str, Any]:
    qids = re.findall(r"question_id:\s*([0-9a-f-]{8,})", user_content, re.I)
    evaluations = []
    for qid in qids or ["mock-q"]:
        evaluations.append(
            {
                "question_id": qid,
                "conceptual_accuracy": 7.5,
                "evidence_support": 7.0,
                "depth": 7.0,
                "relevance": 8.0,
                "overall": 7.5,
                "requires_follow_up": False,
                "explanation": "Mock batch evaluation: answer shows adequate understanding.",
                "evidence_refs": [],
            }
        )
    return {"evaluations": evaluations}


def _mock_next_turn(user_content: str) -> dict[str, Any]:
    planned_ids = re.findall(
        r"['\"]planned_id['\"]\s*:\s*['\"]([0-9a-fA-F-]{36})['\"]",
        user_content,
    )
    planned_id = planned_ids[0] if planned_ids else ""
    opening = "opening question" in user_content.lower()
    shallow = "thin or vague" in user_content.lower() or "looks thin" in user_content.lower()
    excerpts = _extract_excerpts(user_content)
    blocks = _parse_excerpt_blocks(excerpts)
    snippet = _first_sentence(blocks[0]["content"]) if blocks else "your submission"

    if opening:
        return {
            "answer_quality": "partial",
            "mode": "advance",
            "planned_id": planned_id,
            "acknowledgment": "",
            "follow_up_question": "",
            "student_phrase": "",
            "missing_point": "",
            # Legacy fields for older schema consumers.
            "answer_analysis": {
                "quality": "partial",
                "covered": [],
                "missing": [],
                "misconception": "",
                "student_phrase": "",
            },
            "question_text": f"What design choice did you make around '{snippet[:80]}'?",
            "rationale": "Mock opening question.",
        }

    quality = "weak" if shallow else "strong"
    mode = "follow_up" if shallow else "advance"
    if "follow-up limit reached" in user_content.lower() or "must advance" in user_content.lower():
        mode = "advance"
        quality = "partial"

    return {
        "answer_quality": quality,
        "mode": mode,
        "planned_id": planned_id,
        "acknowledgment": "You mentioned the approach" if not shallow else "",
        "follow_up_question": (
            f"Can you go deeper using the detail around '{snippet[:80]}'?" if shallow else ""
        ),
        "student_phrase": "mentioned the approach",
        "missing_point": "specific evidence" if shallow else "",
        "answer_analysis": {
            "quality": quality,
            "covered": ["approach"] if not shallow else [],
            "missing": ["specific evidence"] if shallow else [],
            "misconception": "",
            "student_phrase": "mentioned the approach",
        },
        "question_text": (
            f"Can you go deeper using the detail around '{snippet[:80]}'?"
            if shallow
            else f"What design choice did you make around '{snippet[:80]}'?"
        ),
        "rationale": "Mock follow-up after shallow answer." if shallow else "Mock conversational advance.",
    }


def _mock_follow_up_wording(user_content: str) -> dict[str, Any]:
    m_original = re.search(r"Original question:\s*(.+?)(?:\nStudent answer:|\Z)", user_content, re.S)
    m_answer = re.search(r"Student answer:\s*(.+?)(?:\nConcept:|\n##|\Z)", user_content, re.S)
    m_concept = re.search(r"Concept:\s*(.+?)(?:\n##|\Z)", user_content, re.S)
    original = (m_original.group(1).strip() if m_original else "the previous topic")
    answer = (m_answer.group(1).strip() if m_answer else "")
    concept = (m_concept.group(1).strip() if m_concept else "this topic")
    excerpts = _extract_excerpts(user_content)
    blocks = _parse_excerpt_blocks(excerpts)
    snippet = _first_sentence(blocks[0]["content"]) if blocks else concept
    if len(answer.split()) < 18:
        question_text = (
            f"Your answer about '{concept}' was quite brief. "
            f"Using your submission section on '{snippet}', can you give a more detailed explanation with specific evidence?"
        )
    else:
        question_text = (
            f"You mentioned '{snippet}' in your submission. Can you connect that evidence more directly to '{concept}'?"
        )
    return {
        "question_text": question_text,
        "rationale": f"Follow-up probing for evidence on {concept}.",
    }
