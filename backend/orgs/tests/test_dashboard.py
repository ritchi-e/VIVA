from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from assignments.models import Assignment
from courses.models import Course
from orgs.models import Membership, Organization
from submissions.models import Submission
from viva.models import VivaSession


class DashboardApiTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Dash U", slug="dash-u")
        self.instructor = User.objects.create_user(email="inst@dash.edu", password="x")
        self.student = User.objects.create_user(email="stu@dash.edu", password="x", full_name="Student One")
        Membership.objects.create(organization=self.org, user=self.instructor, role=Membership.Role.INSTRUCTOR)
        Membership.objects.create(organization=self.org, user=self.student, role=Membership.Role.STUDENT)
        self.course = Course.objects.create(
            organization=self.org, code="D101", title="Dash Course", created_by=self.instructor
        )
        self.assignment = Assignment.objects.create(
            course=self.course, title="Essay", status=Assignment.Status.PUBLISHED, created_by=self.instructor
        )
        self.submission = Submission.objects.create(
            assignment=self.assignment, student=self.student, status=Submission.Status.READY
        )
        VivaSession.objects.create(
            assignment=self.assignment,
            submission=self.submission,
            student=self.student,
            state=VivaSession.State.COMPLETED,
            question_budget=4,
            questions_asked=4,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.instructor)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.id))

    def test_dashboard_returns_count_metrics(self):
        response = self.client.get(reverse("org-dashboard"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["courses_count"], 1)
        self.assertEqual(response.data["assignments_count"], 1)
        self.assertEqual(response.data["submissions_count"], 1)
        self.assertEqual(response.data["viva_sessions_count"], 1)
        self.assertEqual(response.data["students_count"], 1)
        self.assertEqual(len(response.data["recent_sessions"]), 1)
        self.assertEqual(response.data["recent_sessions"][0]["student_name"], "Student One")
        self.assertIn("sessions_by_day", response.data)
        self.assertIn("score_buckets", response.data)
        self.assertIn("by_assignment", response.data)
        self.assertEqual(response.data["integrity_terminations"], 0)
        self.assertEqual(response.data["viva_completion"]["integrity_terminated"], 0)

    def test_student_dashboard_list(self):
        response = self.client.get(reverse("org-dashboard-students"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["email"], "stu@dash.edu")
        self.assertEqual(response.data[0]["submissions_count"], 1)

    def test_student_dashboard_detail(self):
        response = self.client.get(reverse("org-dashboard-student-detail", kwargs={"user_id": self.student.id}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["full_name"], "Student One")
        self.assertEqual(response.data["viva_sessions_count"], 1)
