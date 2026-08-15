from django.test import TestCase

from viva.conversation import (
    _follow_up_cap,
    _follow_up_cap_reached,
    _is_duplicate,
    _normalize_live_payload,
    _planned_is_repeat,
    _strip_excerpt_labels,
    _verify_quote,
)
from viva.models import VivaSession


class ConversationHelperTests(TestCase):
    def test_is_duplicate_detects_similar_questions(self):
        previous = [
            "What design choice did you make around the validation metrics?",
            "Walk me through your preprocessing pipeline step by step.",
        ]
        candidate = "What design choice did you make around validation metrics?"
        self.assertTrue(_is_duplicate(candidate, previous))

    def test_is_duplicate_allows_distinct_questions(self):
        previous = ["What design choice did you make around the validation metrics?"]
        candidate = "How did you evaluate scalability under load?"
        self.assertFalse(_is_duplicate(candidate, previous))

    def test_planned_is_repeat_flags_same_concept_and_chunk(self):
        class _Planned:
            concept = "ResNet-18 backbone"
            metadata = {"source_chunk_id": "chunk-1"}

        asked = [
            {
                "concept": "ResNet-18 backbone",
                "source_chunk_id": "chunk-1",
                "is_follow_up": False,
                "text": "Walk me through ResNet-18.",
            }
        ]
        self.assertTrue(_planned_is_repeat(_Planned(), asked, {"ResNet-18 backbone"}))

        asked_follow = [
            {
                "concept": "ResNet-18 backbone",
                "source_chunk_id": "chunk-1",
                "is_follow_up": True,
                "text": "Can you go deeper?",
            }
        ]

        class _Other:
            concept = "Adam optimizer"
            metadata = {"source_chunk_id": "chunk-2"}

        self.assertFalse(_planned_is_repeat(_Other(), asked_follow, set()))

    def test_strip_excerpt_labels(self):
        text = "Referring to Excerpt 2, explain the loop structure?"
        cleaned = _strip_excerpt_labels(text)
        self.assertNotIn("Excerpt 2", cleaned)
        self.assertIn("explain the loop", cleaned.lower())

    def test_verify_quote_matches_chunk_content(self):
        chunks = [
            {
                "chunk_id": "abc",
                "content": "def train_model(data):\n    return model.fit(data)",
                "source_ref": "main.py",
            }
        ]
        self.assertTrue(_verify_quote("def train_model(data):", chunks))
        self.assertFalse(_verify_quote("completely unrelated snippet", chunks))

    def test_follow_up_cap_is_at_least_one_third_of_budget(self):
        class _Session:
            question_budget = 9

        self.assertEqual(_follow_up_cap(_Session()), 3)

    def test_follow_up_cap_reached(self):
        session = VivaSession(question_budget=9)
        session.coverage_state = {"consecutive_follow_ups": 2, "follow_up_total": 1}
        self.assertTrue(_follow_up_cap_reached(session))

        session.coverage_state = {"consecutive_follow_ups": 0, "follow_up_total": 3}
        self.assertTrue(_follow_up_cap_reached(session))

        session.coverage_state = {"consecutive_follow_ups": 1, "follow_up_total": 1}
        self.assertFalse(_follow_up_cap_reached(session))

    def test_normalize_live_payload_maps_slim_schema(self):
        data = _normalize_live_payload(
            {
                "answer_quality": "weak",
                "mode": "follow_up",
                "follow_up_question": "Can you cite your rotation case?",
                "student_phrase": "balance factor",
                "missing_point": "LR case",
            }
        )
        self.assertEqual(data["answer_analysis"]["quality"], "weak")
        self.assertEqual(data["mode"], "follow_up")
        self.assertEqual(data["question_text"], "Can you cite your rotation case?")
        self.assertIn("LR case", data["answer_analysis"]["missing"])
