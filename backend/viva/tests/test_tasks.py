from unittest.mock import patch

from django.test import TestCase, override_settings

from viva.tasks import process_completed_viva_task


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class ProcessCompletedVivaTaskTests(TestCase):
    def test_skips_missing_session_without_retry(self):
        missing_id = "f95062be-7f77-439d-bfab-65dbb72edc1a"
        with patch.object(process_completed_viva_task, "retry") as mock_retry:
            result = process_completed_viva_task.apply(
                args=(missing_id, "00000000-0000-0000-0000-000000000001"),
            )
        mock_retry.assert_not_called()
        self.assertEqual(result.result["status"], "skipped")
        self.assertEqual(result.result["reason"], "session_not_found")
