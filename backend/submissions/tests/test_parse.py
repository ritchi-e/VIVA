from django.test import SimpleTestCase

from submissions.repository.parse import parse_source


class ParseSourceTests(SimpleTestCase):
    def test_python_ast_extracts_functions_classes_and_imports(self):
        source = '''
import preprocessing

class ModelTrainer:
    """Train the model."""

    def fit(self, x):
        return preprocessing.normalize(x)

def train_model():
    """Entry."""
    return ModelTrainer().fit([1])
'''
        result = parse_source(source, "python")
        names = {s.name for s in result.symbols}
        self.assertIn("ModelTrainer", names)
        self.assertIn("train_model", names)
        self.assertIn("ModelTrainer.fit", names)
        self.assertTrue(any(imp.module == "preprocessing" for imp in result.imports))
        trainer = next(s for s in result.symbols if s.name == "train_model")
        self.assertGreaterEqual(trainer.start_line, 1)
        self.assertGreaterEqual(trainer.end_line, trainer.start_line)

    def test_malformed_python_falls_back_without_raising(self):
        result = parse_source("def broken(:\n", "python")
        self.assertEqual(result.language, "python")

    def test_javascript_regex_parser(self):
        source = """
import { api } from './client'
export function fetchUsers() {
  return api.get('/users')
}
export class Store {}
"""
        result = parse_source(source, "javascript")
        names = {s.name for s in result.symbols}
        self.assertIn("fetchUsers", names)
        self.assertIn("Store", names)
        self.assertTrue(result.imports)
