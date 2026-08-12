from django.test import TestCase

from viva.conversation import (
    _follow_up_cap,
    _follow_up_cap_reached,
    _is_duplicate,
    _strip_excerpt_labels,
    _verify_quote,
)


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
