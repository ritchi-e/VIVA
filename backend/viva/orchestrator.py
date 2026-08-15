from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone

from orgs.models import Organization
from questions.models import PlannedQuestion
from questions.planner import plan_questions
from submissions.models import Submission
from viva.conversation import generate_next_turn
from viva.models import (
    QuestionAttempt,
    StudentAnswer,
    VivaQuestion,
    VivaSession,
)

logger = logging.getLogger(__name__)

ALLOWED_TRANSITIONS = {
    VivaSession.State.CREATED: {VivaSession.State.PREPARING, VivaSession.State.FAILED},
    VivaSession.State.PREPARING: {VivaSession.State.READY, VivaSession.State.FAILED},
    VivaSession.State.READY: {VivaSession.State.IN_PROGRESS, VivaSession.State.FAILED},
    VivaSession.State.IN_PROGRESS: {
        VivaSession.State.COMPLETED,
        VivaSession.State.REVIEW_REQUIRED,
        VivaSession.State.PAUSED,
        VivaSession.State.FAILED,
    },
    VivaSession.State.PAUSED: {VivaSession.State.IN_PROGRESS, VivaSession.State.FAILED},
    VivaSession.State.REVIEW_REQUIRED: {VivaSession.State.COMPLETED, VivaSession.State.FAILED},
}


class VivaOrchestrator:
    def __init__(self, session: VivaSession, organization: Organization):
        self.session = session
        self.organization = organization

    def _refresh(self) -> None:
        self.session.refresh_from_db()

    def _transition(self, new_state: str) -> None:
        current = self.session.state
        allowed = ALLOWED_TRANSITIONS.get(current, set())
        if new_state not in allowed and new_state != current:
            raise ValueError(f"Invalid transition {current} -> {new_state}")
        self.session.state = new_state
        self.session.save(update_fields=["state", "updated_at"])

    def prepare(self) -> VivaSession:
        import time

        self._refresh()
        if self.session.state in (
            VivaSession.State.READY,
            VivaSession.State.IN_PROGRESS,
            VivaSession.State.COMPLETED,
            VivaSession.State.REVIEW_REQUIRED,
            VivaSession.State.FAILED,
        ):
            return self.session

        # Another request may already be preparing — wait briefly instead of racing.
        if self.session.state == VivaSession.State.PREPARING:
            for _ in range(90):
                time.sleep(1)
                self._refresh()
                if self.session.state != VivaSession.State.PREPARING:
                    return self.session
            self.session.error_message = "Timed out while preparing viva questions"
            self._transition(VivaSession.State.FAILED)
            return self.session

        if self.session.state != VivaSession.State.CREATED:
            return self.session

        self._transition(VivaSession.State.PREPARING)
        submission = self.session.submission
        if submission.status != Submission.Status.READY:
            self.session.error_message = "Submission is not ready for viva"
            self._transition(VivaSession.State.FAILED)
            return self.session
        try:
            plan_questions(
                submission,
                self.organization,
                viva_session=self.session,
                budget=self.session.question_budget,
            )
            self._prefetch_first_turn()
            # Do not pre-word questions — live turns are generated conversationally.
            self._transition(VivaSession.State.READY)
        except Exception as exc:
            logger.exception("Viva prepare failed")
            self.session.error_message = str(exc)
            self._transition(VivaSession.State.FAILED)
        return self.session

    def _serialize_turn_for_cache(self, turn: dict[str, Any]) -> dict[str, Any]:
        cached = {k: v for k, v in turn.items() if k not in ("planned", "parent_planned")}
        planned = turn.get("planned")
        parent = turn.get("parent_planned")
        if planned is not None:
            cached["planned_id"] = str(planned.id)
        if parent is not None:
            cached["parent_planned_id"] = str(parent.id)
        return cached

    def _hydrate_cached_turn(self, turn: dict[str, Any], plan) -> dict[str, Any]:
        hydrated = dict(turn)
        planned_id = hydrated.get("planned_id")
        if planned_id and not hydrated.get("planned"):
            hydrated["planned"] = plan.questions.filter(pk=planned_id).first()
        parent_id = hydrated.get("parent_planned_id")
        if parent_id and not hydrated.get("parent_planned"):
            hydrated["parent_planned"] = plan.questions.filter(pk=parent_id).first()
        return hydrated

    def _prefetch_first_turn(self) -> None:
        """Generate the opening question during prepare so start() is instant."""
        if self.session.questions.exists():
            return
        plan = self.session.question_plans.order_by("-created_at").first()
        if not plan:
            return
        try:
            turn = generate_next_turn(self.session, self.organization, plan=plan)
            if turn.get("mode") == "complete":
                return
            config = dict(self.session.config or {})
            config["prefetched_turn"] = self._serialize_turn_for_cache(turn)
            self.session.config = config
            self.session.save(update_fields=["config", "updated_at"])
        except Exception:
            logger.exception("Prefetch first viva turn failed")

    def _consume_prefetched_turn(self) -> dict[str, Any] | None:
        config = dict(self.session.config or {})
        turn = config.pop("prefetched_turn", None)
        if turn:
            self.session.config = config
            self.session.save(update_fields=["config", "updated_at"])
        return turn if isinstance(turn, dict) else None

    def start(self) -> VivaSession:
        self._refresh()
        if self.session.state == VivaSession.State.CREATED:
            self.prepare()
            self._refresh()
        if self.session.state == VivaSession.State.IN_PROGRESS:
            return self.session
        if self.session.state != VivaSession.State.READY:
            raise ValueError(f"Cannot start viva in state {self.session.state}")
        self.session.started_at = timezone.now()
        self._transition(VivaSession.State.IN_PROGRESS)
        if not self.session.questions.exists():
            self._ask_next_question()
        return self.session

    def _ask_next_question(self) -> VivaQuestion | None:
        if self.session.questions_asked >= self.session.question_budget:
            self.complete()
            return None
        plan = self.session.question_plans.order_by("-created_at").first()
        if not plan:
            self.session.error_message = "No question plan"
            self._transition(VivaSession.State.FAILED)
            return None
        if not plan.questions.exclude(is_follow_up=True).exists():
            self.session.error_message = (
                "Question plan has no questions. Re-prepare the viva or contact support."
            )
            self._transition(VivaSession.State.FAILED)
            return None

        turn = self._consume_prefetched_turn()
        if turn is not None:
            turn = self._hydrate_cached_turn(turn, plan)
            return self._create_question_from_turn(turn, plan)

        turn = generate_next_turn(self.session, self.organization, plan=plan)
        if turn.get("mode") == "complete":
            self.complete()
            return None

        return self._create_question_from_turn(turn, plan)

    def _create_question_from_turn(self, turn: dict[str, Any], plan) -> VivaQuestion | None:
        """Persist a conversational turn as a VivaQuestion."""
        if turn.get("mode") == "complete":
            self.complete()
            return None

        planned = turn.get("planned")
        mode = turn.get("mode") or "advance"
        if mode == "follow_up":
            parent = turn.get("parent_planned") or planned
            planned = PlannedQuestion.objects.create(
                plan=plan,
                order=9000 + self.session.questions_asked,
                question_type=(parent.question_type if parent else PlannedQuestion.QuestionType.CONCEPTUAL),
                difficulty=(parent.difficulty if parent else "medium"),
                concept=(parent.concept if parent else "follow-up"),
                purpose=(parent.purpose if parent else "Probe a shallow answer"),
                expected_evidence=(parent.expected_evidence if parent else ""),
                source_artifact=(parent.source_artifact if parent else "submission"),
                source_ref=(parent.source_ref if parent else ""),
                wording=turn.get("raw_question") or turn.get("question_text") or "",
                is_follow_up=True,
                parent_question=parent,
                rubric_criterion=(parent.rubric_criterion if parent else None),
                learning_outcome=(parent.learning_outcome if parent else None),
                metadata={
                    "planned_by": "ai.conversation",
                    "mode": "follow_up",
                    "source_quote": (parent.metadata or {}).get("source_quote") if parent else "",
                    "rag_chunks": turn.get("rag_chunks") or [],
                    "rag_chunk_ids": [
                        str(c.get("chunk_id"))
                        for c in (turn.get("rag_chunks") or [])
                        if c.get("chunk_id")
                    ],
                    "bridge": turn.get("bridge") or "",
                    "rationale": turn.get("rationale") or "",
                },
            )
        elif planned and not planned.wording:
            planned.wording = turn.get("raw_question") or turn.get("question_text") or ""
            planned.metadata = {
                **(planned.metadata or {}),
                "worded_live": True,
                "bridge": turn.get("bridge") or "",
                "rationale": turn.get("rationale") or "",
            }
            planned.save(update_fields=["wording", "metadata", "updated_at"])

        sequence = self.session.questions_asked + 1
        rag_chunks = turn.get("rag_chunks") or (planned.metadata.get("rag_chunks") if planned else []) or []
        excerpt = turn.get("excerpt") or {}
        vq = VivaQuestion.objects.create(
            session=self.session,
            planned_question=planned,
            sequence=sequence,
            question_text=turn.get("question_text") or (planned.wording if planned else ""),
            question_type=(planned.question_type if planned else PlannedQuestion.QuestionType.CONCEPTUAL),
            provenance={
                "planned_question_id": str(planned.id) if planned else None,
                "mode": mode,
                "conversational": True,
                "bridge": turn.get("bridge") or turn.get("acknowledgment") or "",
                "acknowledgment": turn.get("acknowledgment") or turn.get("bridge") or "",
                "rationale": turn.get("rationale") or "",
                "concept": planned.concept if planned else "",
                "source_ref": excerpt.get("source_ref") or (planned.source_ref if planned else ""),
                "purpose": planned.purpose if planned else "",
                "expected_evidence": planned.expected_evidence if planned else "",
                "source_artifact": planned.source_artifact if planned else "",
                "excerpt": excerpt,
                "rag_chunk_ids": [
                    str(c.get("chunk_id")) for c in rag_chunks if c.get("chunk_id")
                ],
                "rag_chunks": rag_chunks,
            },
        )
        QuestionAttempt.objects.create(question=vq, attempt_number=1)
        self.session.questions_asked = sequence
        self._update_session_memory(turn, vq)
        self.session.save(update_fields=["questions_asked", "coverage_state", "understanding_state", "updated_at"])
        return vq

    def _update_session_memory(self, turn: dict[str, Any], vq: VivaQuestion) -> None:
        """Persist coverage and answer-analysis state after each new question."""
        mode = turn.get("mode") or "advance"
        answer_analysis = turn.get("answer_analysis") or {}
        planned = turn.get("planned")

        coverage = dict(self.session.coverage_state or {})
        asked = list(coverage.get("asked") or [])
        asked.append(
            {
                "seq": vq.sequence,
                "concept": (planned.concept if planned else "") or (vq.provenance or {}).get("concept", ""),
                "text": vq.question_text,
            }
        )
        coverage["asked"] = asked

        consecutive = int(coverage.get("consecutive_follow_ups") or 0)
        follow_up_total = int(coverage.get("follow_up_total") or 0)
        if mode == "follow_up":
            consecutive += 1
            follow_up_total += 1
        else:
            consecutive = 0
        coverage["consecutive_follow_ups"] = consecutive
        coverage["follow_up_total"] = follow_up_total

        covered_concepts = list(coverage.get("covered_concepts") or [])
        quality = str(answer_analysis.get("quality") or "").lower()
        if mode == "advance" and planned and quality in ("strong", "partial"):
            concept = planned.concept
            if concept and concept not in covered_concepts:
                covered_concepts.append(concept)
        coverage["covered_concepts"] = covered_concepts
        self.session.coverage_state = coverage

        if answer_analysis:
            prev_question = (
                self.session.questions.filter(sequence__lt=vq.sequence).order_by("-sequence").first()
            )
            if prev_question:
                attempt = prev_question.attempts.order_by("-attempt_number").first()
                answer = attempt.answers.order_by("-submitted_at").first() if attempt else None
                if answer:
                    understanding = dict(self.session.understanding_state or {})
                    answers_map = dict(understanding.get("answers") or {})
                    answers_map[str(answer.id)] = answer_analysis
                    understanding["answers"] = answers_map
                    self.session.understanding_state = understanding

    def _latest_answer(self, question: VivaQuestion) -> StudentAnswer | None:
        attempt = question.attempts.order_by("-attempt_number").first()
        if not attempt:
            return None
        return attempt.answers.order_by("-submitted_at").first()

    def _result_payload(
        self,
        *,
        answer: StudentAnswer | None,
        next_question: VivaQuestion | None,
    ) -> dict[str, Any]:
        next_excerpt = None
        if next_question:
            provenance = next_question.provenance or {}
            excerpt = provenance.get("excerpt")
            if isinstance(excerpt, dict) and (excerpt.get("quote") or "").strip():
                next_excerpt = excerpt
        return {
            "answer_id": str(answer.id) if answer else None,
            "evaluation": None,  # Evaluations run after the viva completes
            "next_question_id": str(next_question.id) if next_question else None,
            "next_question_text": next_question.question_text if next_question else None,
            "next_question_sequence": next_question.sequence if next_question else None,
            "next_question_excerpt": next_excerpt,
            "session_state": self.session.state,
            "questions_asked": self.session.questions_asked,
            "question_budget": self.session.question_budget,
            "evaluation_pending": self.session.state
            in (VivaSession.State.COMPLETED, VivaSession.State.REVIEW_REQUIRED),
        }

    def submit_answer(self, question_id, text: str, *, input_mode: str = "text") -> dict[str, Any]:
        self._refresh()

        # Auto-recover if the session was prepared but never started.
        if self.session.state == VivaSession.State.READY:
            self.start()
            self._refresh()

        if self.session.state in (VivaSession.State.COMPLETED, VivaSession.State.REVIEW_REQUIRED):
            return self._result_payload(answer=None, next_question=None)

        if self.session.state != VivaSession.State.IN_PROGRESS:
            raise ValueError(f"Viva is not in progress (state={self.session.state})")

        vq = VivaQuestion.objects.get(pk=question_id, session=self.session)
        existing = self._latest_answer(vq)
        if existing:
            # Idempotent: already answered this question — advance if needed.
            next_q = (
                self.session.questions.filter(sequence__gt=vq.sequence).order_by("sequence").first()
            )
            if next_q is None and self.session.questions_asked < self.session.question_budget:
                next_q = self._ask_next_question()
            elif next_q is None and self.session.state == VivaSession.State.IN_PROGRESS:
                self.complete()
            self._refresh()
            return self._result_payload(answer=existing, next_question=next_q)

        attempt = vq.attempts.order_by("-attempt_number").first()
        if not attempt:
            attempt = QuestionAttempt.objects.create(question=vq, attempt_number=1)
        answer = StudentAnswer.objects.create(attempt=attempt, text=text, input_mode=input_mode)
        attempt.completed_at = timezone.now()
        attempt.save(update_fields=["completed_at", "updated_at"])

        # Next question is generated live from dialogue + remaining coverage plan.
        next_question = None
        if vq.sequence >= self.session.question_budget:
            self.complete()
        elif self.session.questions_asked < self.session.question_budget:
            next_question = self._ask_next_question()
        else:
            self.complete()
        self._refresh()
        return self._result_payload(answer=answer, next_question=next_question)

    def complete(self) -> VivaSession:
        self._refresh()
        if self.session.state not in (
            VivaSession.State.IN_PROGRESS,
            VivaSession.State.REVIEW_REQUIRED,
        ):
            return self.session
        # Mark complete immediately; AI evaluation runs asynchronously after.
        if self.session.state == VivaSession.State.IN_PROGRESS:
            self._transition(VivaSession.State.COMPLETED)
        self.session.completed_at = timezone.now()
        self.session.save(update_fields=["completed_at", "updated_at"])
        self._enqueue_post_process()
        return self.session

    def terminate_integrity(self, *, reason: str, metadata: dict[str, Any] | None = None) -> VivaSession:
        """End a live viva for an integrity violation without running normal evaluation."""
        self._refresh()
        if self.session.state == VivaSession.State.FAILED:
            return self.session
        if self.session.state not in (
            VivaSession.State.IN_PROGRESS,
            VivaSession.State.PAUSED,
            VivaSession.State.READY,
        ):
            return self.session

        details = dict(metadata or {})
        details["reason"] = reason
        details["at"] = timezone.now().isoformat()
        config = dict(self.session.config or {})
        config["integrity_termination"] = details
        self.session.config = config
        if reason == "grace_expired":
            self.session.error_message = (
                "Viva stopped: student left the exam window for more than 5 seconds."
            )
        elif reason == "camera_denied":
            self.session.error_message = "Viva stopped: camera access is required for live monitoring."
        else:
            self.session.error_message = f"Viva stopped for integrity: {reason}."

        if self.session.state == VivaSession.State.READY:
            # Skip start; fail from READY (allowed).
            self._transition(VivaSession.State.FAILED)
        else:
            self._transition(VivaSession.State.FAILED)
        self.session.completed_at = timezone.now()
        self.session.save(update_fields=["config", "error_message", "completed_at", "updated_at"])
        self._enqueue_integrity_notice(reason)
        return self.session

    def _enqueue_integrity_notice(self, reason: str) -> None:
        from django.db import transaction

        session_id = str(self.session.id)
        org_id = str(self.organization.id)

        def _dispatch() -> None:
            try:
                from viva.tasks import notify_integrity_termination_task

                notify_integrity_termination_task.delay(session_id, org_id, reason)
            except Exception:
                logger.exception("Failed to enqueue integrity notice for session %s", session_id)

        transaction.on_commit(_dispatch)

    def _enqueue_post_process(self) -> None:
        from django.db import transaction

        org_id = str(self.organization.id)
        session_id = str(self.session.id)

        def _dispatch() -> None:
            try:
                from viva.tasks import process_completed_viva_task

                process_completed_viva_task.delay(session_id, org_id)
            except Exception:
                logger.exception("Failed to enqueue post-viva task; running inline")
                try:
                    from viva.post_process import process_completed_viva

                    process_completed_viva(self.session, self.organization)
                except Exception:
                    logger.exception("Inline post-viva processing failed")

        transaction.on_commit(_dispatch)
