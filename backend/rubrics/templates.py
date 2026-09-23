"""Predefined rubric packs faculty can apply in one click.

Most coursework assessments share the same evaluation dimensions.
Templates encode those common packs so instructors pick a set instead of
typing criteria from scratch; custom criteria remain available when needed.
"""

from __future__ import annotations

from typing import Any


def _c(
    name: str,
    description: str,
    *,
    category: str,
    weight: float = 1.0,
    max_score: float = 10.0,
    order: int = 0,
) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "category": category,
        "weight": weight,
        "max_score": max_score,
        "order": order,
    }


# Shared library of individual criteria (used for bubble toggles + packs).
CRITERION_LIBRARY: list[dict[str, Any]] = [
    _c(
        "Conceptual understanding",
        "Explains core concepts accurately and connects them to the work.",
        category="conceptual",
        order=0,
    ),
    _c(
        "Problem framing",
        "Defines the problem, scope, and success criteria clearly.",
        category="methodology",
        order=1,
    ),
    _c(
        "Methodology & approach",
        "Chooses and justifies an appropriate method or process.",
        category="methodology",
        order=2,
    ),
    _c(
        "Implementation quality",
        "Execution is sound, complete, and consistent with the stated approach.",
        category="implementation",
        order=3,
    ),
    _c(
        "Code quality & design",
        "Structure, readability, correctness, and maintainability of the code.",
        category="implementation",
        order=4,
    ),
    _c(
        "Testing & validation",
        "Evidence that the solution was tested or validated appropriately.",
        category="implementation",
        order=5,
    ),
    _c(
        "Results & analysis",
        "Interprets outcomes critically and relates them to the goals.",
        category="results",
        order=6,
    ),
    _c(
        "Evidence & citation",
        "Uses credible sources and attributes them correctly.",
        category="critical_thinking",
        order=7,
    ),
    _c(
        "Critical thinking",
        "Evaluates trade-offs, limitations, and alternative explanations.",
        category="critical_thinking",
        order=8,
    ),
    _c(
        "Communication & clarity",
        "Explains ideas clearly in writing and/or oral discussion.",
        category="communication",
        order=9,
    ),
    _c(
        "Visual / design quality",
        "Visual hierarchy, usability, and polish of the designed artifact.",
        category="implementation",
        order=10,
    ),
    _c(
        "Experimental rigor",
        "Controls, measurement quality, and reproducibility of the experiment.",
        category="methodology",
        order=11,
    ),
    _c(
        "Oral defense",
        "Responds to questions with precision, composure, and depth.",
        category="communication",
        order=12,
    ),
    _c(
        "Ethics & integrity",
        "Handles data, attribution, and academic integrity appropriately.",
        category="critical_thinking",
        order=13,
    ),
]


def _by_names(names: list[str]) -> list[dict[str, Any]]:
    index = {c["name"]: c for c in CRITERION_LIBRARY}
    out: list[dict[str, Any]] = []
    for i, name in enumerate(names):
        base = index.get(name)
        if not base:
            continue
        item = dict(base)
        item["order"] = i
        out.append(item)
    return out


RUBRIC_TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "general_project",
        "label": "General project",
        "description": "Understanding, method, execution, results, and clarity — fits most coursework.",
        "title": "General project rubric",
        "criteria": _by_names(
            [
                "Conceptual understanding",
                "Methodology & approach",
                "Implementation quality",
                "Results & analysis",
                "Communication & clarity",
            ]
        ),
    },
    {
        "id": "software_project",
        "label": "Software / coding",
        "description": "Problem framing, design, code quality, testing, and defense.",
        "title": "Software project rubric",
        "criteria": _by_names(
            [
                "Problem framing",
                "Code quality & design",
                "Implementation quality",
                "Testing & validation",
                "Oral defense",
            ]
        ),
    },
    {
        "id": "research_paper",
        "label": "Research / essay",
        "description": "Framing, evidence, analysis, critical thinking, and writing.",
        "title": "Research & writing rubric",
        "criteria": _by_names(
            [
                "Problem framing",
                "Evidence & citation",
                "Critical thinking",
                "Results & analysis",
                "Communication & clarity",
            ]
        ),
    },
    {
        "id": "lab_report",
        "label": "Lab / experiment",
        "description": "Method rigor, execution, analysis, and integrity.",
        "title": "Lab report rubric",
        "criteria": _by_names(
            [
                "Methodology & approach",
                "Experimental rigor",
                "Results & analysis",
                "Critical thinking",
                "Ethics & integrity",
            ]
        ),
    },
    {
        "id": "design_ux",
        "label": "Design / UX",
        "description": "Problem framing, design quality, validation, and communication.",
        "title": "Design project rubric",
        "criteria": _by_names(
            [
                "Problem framing",
                "Visual / design quality",
                "Methodology & approach",
                "Testing & validation",
                "Communication & clarity",
            ]
        ),
    },
    {
        "id": "presentation_defense",
        "label": "Presentation / viva",
        "description": "Understanding, critical thinking, and oral defense focus.",
        "title": "Presentation & viva rubric",
        "criteria": _by_names(
            [
                "Conceptual understanding",
                "Critical thinking",
                "Results & analysis",
                "Oral defense",
                "Communication & clarity",
            ]
        ),
    },
]


def list_templates() -> list[dict[str, Any]]:
    return [
        {
            "id": t["id"],
            "label": t["label"],
            "description": t["description"],
            "title": t["title"],
            "criteria": t["criteria"],
        }
        for t in RUBRIC_TEMPLATES
    ]


def list_criterion_library() -> list[dict[str, Any]]:
    return [dict(c) for c in CRITERION_LIBRARY]


def get_template(template_id: str) -> dict[str, Any] | None:
    for t in RUBRIC_TEMPLATES:
        if t["id"] == template_id:
            return t
    return None
