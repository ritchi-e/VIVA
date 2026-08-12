from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from assignments.models import Assignment, LearningOutcome
from courses.models import Course, CourseEnrollment
from orgs.models import Membership, Organization
from rubrics.models import Rubric, RubricCriterion
from submissions.models import Submission, SubmissionChunk, SubmissionFile
from viva.models import VivaSession


DEMO_PASSWORD = "DemoPass123!"


ML_SUBMISSION = """
# Predicting Customer Churn with Gradient Boosting

## Problem
Customer churn reduces recurring revenue. We predict which customers are likely to leave.

## Objectives
1. Build a binary classifier for churn.
2. Compare logistic regression and XGBoost.
3. Interpret feature importance for retention interventions.

## Methodology
We used a public telecom churn dataset. Features were normalized. Missing values were imputed with median.
We selected XGBoost because it performed better on the validation F1 score.

## Implementation
Python, scikit-learn, and XGBoost. Pipeline: train_test_split -> StandardScaler -> model fit -> evaluation.

## Results
XGBoost F1=0.81 vs Logistic Regression F1=0.74. Top features: contract type, monthly charges, tenure.

## Conclusions
Tree-based boosting better captures non-linear interactions for this dataset.

## Limitations
Class imbalance may inflate accuracy; we did not fully explore calibration or cost-sensitive thresholds.
"""

SE_SUBMISSION = """
# Task Tracker API Design

## Problem
Teams need a simple REST API for assigning and tracking software tasks.

## Objectives
Provide CRUD for projects and tasks with JWT auth and role-based access.

## Methodology
Domain-driven design with a modular monolith. PostgreSQL for persistence.

## Implementation
Django REST Framework, JWT, Celery for notifications. Repository pattern in services.

## Results
p95 latency under 120ms for task list with pagination. 92% unit test coverage.

## Conclusions
A modular monolith is sufficient before microservices are justified.

## Limitations
No multi-region deployment; notification delivery is best-effort.
"""

DS_SUBMISSION = """
# Balanced Binary Search Tree Project

## Problem
Implement an AVL tree supporting insert, delete, and ordered traversal.

## Objectives
Maintain O(log n) height after updates and verify rotations.

## Methodology
Follow standard AVL rotation cases: LL, RR, LR, RL.

## Implementation
C++ class AvlTree with Node height metadata and recursive rebalance.

## Results
Height stayed within 1.45 * log2(n) across randomized insert/delete workloads.

## Conclusions
Rotations correctly restore balance invariants.

## Limitations
No concurrency support; delete edge cases for duplicate keys remain.
"""


class Command(BaseCommand):
    help = "Seed fictional demo data for AI Viva (institution, courses, submissions, sessions)"

    def _ensure_user(self, email: str, full_name: str) -> User:
        """Create or update a demo user with username=email (required by AbstractUser unique constraint)."""
        email = email.lower()
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            user = User.objects.create_user(
                email=email,
                password=DEMO_PASSWORD,
                full_name=full_name,
                email_verified=True,
            )
        else:
            if not user.username or user.username != email:
                user.username = email
            user.full_name = full_name or user.full_name
            user.email_verified = True
            user.set_password(DEMO_PASSWORD)
            user.save()
        return user

    def _cleanup_blank_usernames(self) -> None:
        for broken in User.all_objects.filter(username=""):
            broken.hard_delete()

    @transaction.atomic
    def handle(self, *args, **options):
        self._cleanup_blank_usernames()

        org, _ = Organization.objects.get_or_create(
            slug="northbridge-university",
            defaults={"name": "Northbridge University", "settings": {"timezone": "UTC"}},
        )

        instructor = self._ensure_user("instructor@northbridge.edu", "Dr. Avery Chen")
        admin = self._ensure_user("admin@northbridge.edu", "Sam Okonkwo")

        students = [
            self._ensure_user(email, name)
            for email, name in [
                ("alex.morgan@student.northbridge.edu", "Alex Morgan"),
                ("jordan.lee@student.northbridge.edu", "Jordan Lee"),
                ("riley.patel@student.northbridge.edu", "Riley Patel"),
            ]
        ]

        Membership.objects.get_or_create(
            organization=org, user=admin, defaults={"role": Membership.Role.ORGANIZATION_ADMIN}
        )
        Membership.objects.get_or_create(
            organization=org, user=instructor, defaults={"role": Membership.Role.INSTRUCTOR}
        )
        for s in students:
            Membership.objects.get_or_create(
                organization=org, user=s, defaults={"role": Membership.Role.STUDENT}
            )

        courses_spec = [
            ("CS501", "Machine Learning", "Fall 2025", ML_SUBMISSION, "Build and defend an ML project"),
            ("SE320", "Software Engineering", "Fall 2025", SE_SUBMISSION, "Design and implement a backend API"),
            ("CS210", "Data Structures", "Fall 2025", DS_SUBMISSION, "Implement and analyze an AVL tree"),
        ]

        for idx, (code, title, term, body, instructions) in enumerate(courses_spec):
            course, _ = Course.objects.get_or_create(
                organization=org,
                code=code,
                term=term,
                defaults={
                    "title": title,
                    "description": f"Demo course in {title}",
                    "created_by": instructor,
                },
            )
            CourseEnrollment.objects.get_or_create(
                course=course, user=instructor, defaults={"role": CourseEnrollment.Role.INSTRUCTOR}
            )
            for s in students:
                CourseEnrollment.objects.get_or_create(
                    course=course, user=s, defaults={"role": CourseEnrollment.Role.STUDENT}
                )

            assignment, _ = Assignment.objects.get_or_create(
                course=course,
                title=f"{title} Capstone",
                defaults={
                    "description": f"Capstone assessment for {title}",
                    "instructions": instructions,
                    "status": Assignment.Status.PUBLISHED,
                    "created_by": instructor,
                    "viva_config": {"question_budget": 6, "time_limit_seconds": 1200},
                },
            )
            for i, lo in enumerate(
                [
                    ("LO1", "Explain problem framing and objectives"),
                    ("LO2", "Justify methodology and design decisions"),
                    ("LO3", "Interpret results and limitations critically"),
                ]
            ):
                LearningOutcome.objects.get_or_create(
                    assignment=assignment, code=lo[0], defaults={"description": lo[1], "order": i}
                )

            rubric, _ = Rubric.objects.get_or_create(
                assignment=assignment,
                defaults={"title": f"{title} Rubric", "description": "Evidence-backed oral assessment rubric"},
            )
            for order, (name, category, weight) in enumerate(
                [
                    ("Conceptual Understanding", "conceptual", 1.5),
                    ("Methodology", "methodology", 1.5),
                    ("Implementation", "implementation", 1.2),
                    ("Results Interpretation", "results", 1.2),
                    ("Critical Thinking", "critical_thinking", 1.0),
                    ("Communication", "communication", 0.8),
                ]
            ):
                RubricCriterion.objects.get_or_create(
                    rubric=rubric,
                    name=name,
                    defaults={
                        "category": category,
                        "weight": weight,
                        "max_score": 10,
                        "order": order,
                        "description": f"Assess {name.lower()}",
                    },
                )

            student = students[idx % len(students)]
            submission, _ = Submission.objects.get_or_create(
                assignment=assignment,
                student=student,
                version=1,
                defaults={
                    "status": Submission.Status.READY,
                    "metadata": {"demo": True, "discipline": title},
                    "knowledge_representation": {
                        "problem": body.split("## Problem")[1].split("##")[0].strip() if "## Problem" in body else "",
                        "objectives": ["Demonstrate understanding"],
                    },
                    "processed_at": timezone.now(),
                },
            )
            sf, _ = SubmissionFile.objects.get_or_create(
                submission=submission,
                original_filename=f"{code.lower()}_report.txt",
                defaults={
                    "content_type": "text/plain",
                    "file_type": SubmissionFile.FileType.OTHER,
                    "size_bytes": len(body.encode()),
                    "storage_key": f"demo/{org.slug}/{assignment.id}/{student.id}/report.txt",
                    "extracted_text": body,
                    "structure": {"sections": ["Problem", "Objectives", "Methodology", "Results", "Limitations"]},
                },
            )
            if not submission.chunks.exists():
                chunks = [body[i : i + 800] for i in range(0, len(body), 800)]
                from ai.service import AIService

                vectors = AIService(organization=org).embed(chunks).vectors
                for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
                    SubmissionChunk.objects.create(
                        submission=submission,
                        file=sf,
                        chunk_index=i,
                        content=chunk,
                        token_count=len(chunk.split()),
                        embedding=vec,
                        source_ref=f"demo-report#chunk-{i}",
                        metadata={"demo": True},
                    )

            VivaSession.objects.get_or_create(
                assignment=assignment,
                submission=submission,
                student=student,
                defaults={
                    "state": VivaSession.State.CREATED,
                    "mode": VivaSession.Mode.TEXT,
                    "question_budget": 6,
                },
            )

        self.stdout.write(self.style.SUCCESS("Demo data seeded."))
        self.stdout.write("Accounts (password: DemoPass123!):")
        self.stdout.write("  admin@northbridge.edu (organization_admin)")
        self.stdout.write("  instructor@northbridge.edu (instructor)")
        self.stdout.write("  alex.morgan@student.northbridge.edu (student)")
        self.stdout.write("  jordan.lee@student.northbridge.edu (student)")
        self.stdout.write("  riley.patel@student.northbridge.edu (student)")
