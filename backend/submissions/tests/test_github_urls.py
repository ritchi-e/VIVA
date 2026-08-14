from django.test import SimpleTestCase

from submissions.repository.urls import GithubUrlError, parse_github_url


class ParseGithubUrlTests(SimpleTestCase):
    def test_canonical_public_url(self):
        parsed = parse_github_url("https://github.com/student/final-year-project")
        self.assertEqual(parsed.owner, "student")
        self.assertEqual(parsed.repo, "final-year-project")
        self.assertEqual(parsed.canonical_url, "https://github.com/student/final-year-project")
        self.assertIsNone(parsed.ref)

    def test_strips_git_suffix_and_tree_ref(self):
        parsed = parse_github_url("https://github.com/org/repo.git")
        self.assertEqual(parsed.repo, "repo")
        parsed = parse_github_url("https://github.com/org/repo/tree/main")
        self.assertEqual(parsed.ref, "main")

    def test_rejects_credentials_and_non_https(self):
        with self.assertRaises(GithubUrlError):
            parse_github_url("https://user:pass@github.com/org/repo")
        with self.assertRaises(GithubUrlError):
            parse_github_url("http://github.com/org/repo")
        with self.assertRaises(GithubUrlError):
            parse_github_url("https://gitlab.com/org/repo")
        with self.assertRaises(GithubUrlError):
            parse_github_url("https://github.com/org/repo?token=1")
        with self.assertRaises(GithubUrlError):
            parse_github_url("https://gist.github.com/abc")
