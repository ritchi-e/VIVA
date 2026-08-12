from __future__ import annotations

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from viva.models import VivaQuestion, VivaSession
from viva.orchestrator import VivaOrchestrator

logger = logging.getLogger(__name__)


class VivaSessionConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]
        user = self.scope.get("user")
        if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
            await self.close()
            return
        self.session = await self._get_session()
        if not self.session:
            await self.close()
            return
        if str(self.session.student_id) != str(user.id) and not user.is_superuser:
            await self.close()
            return
        self.group_name = f"viva_{self.session_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connected", "session_id": self.session_id, "state": self.session.state})

        if self.session.state in (VivaSession.State.COMPLETED, VivaSession.State.REVIEW_REQUIRED):
            await self.send_json({"type": "complete", "state": self.session.state})
            return

        # Fast path: session already prepared/started by REST.
        question = await self._current_open_question()
        if question:
            await self._send_question(question)
            return

        if self.session.state in (VivaSession.State.CREATED, VivaSession.State.PREPARING, VivaSession.State.READY):
            await self.send_json(
                {
                    "type": "status",
                    "message": "Preparing your viva questions. This can take a moment…",
                    "state": self.session.state,
                }
            )
            try:
                question = await self._ensure_started()
            except Exception as exc:
                logger.exception("Failed to prepare/start viva over websocket")
                await self.send_json({"type": "error", "message": str(exc)})
                return
            if question:
                await self._send_question(question)
            else:
                session = await self._get_session()
                await self.send_json(
                    {
                        "type": "error",
                        "message": (session.error_message if session else None)
                        or "Could not load the first viva question. Please retry.",
                    }
                )

    async def _send_question(self, question: VivaQuestion):
        provenance = question.provenance or {}
        excerpt = provenance.get("excerpt")
        payload: dict = {
            "type": "question",
            "text": question.question_text,
            "question_id": str(question.id),
            "sequence": question.sequence,
        }
        if isinstance(excerpt, dict) and excerpt.get("quote"):
            payload["excerpt"] = {
                "quote": excerpt.get("quote") or "",
                "source_ref": excerpt.get("source_ref") or "",
            }
        await self.send_json(payload)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        action = content.get("action") or content.get("type")
        if action == "answer":
            text = (content.get("text") or "").strip()
            question_id = content.get("question_id")
            input_mode = content.get("input_mode", "text")
            if not text:
                await self.send_json({"type": "error", "message": "Answer text is required."})
                return
            if not question_id:
                question_id = await self._current_question_id()
            if not question_id:
                await self.send_json({"type": "error", "message": "No active question to answer."})
                return
            await self.send_json({"type": "processing", "message": "Examiner is thinking…"})
            try:
                result = await self._submit_answer(question_id, text, input_mode)
            except Exception as exc:
                logger.exception("Answer submit failed for session %s", self.session_id)
                await self.send_json({"type": "error", "message": str(exc)})
                return

            await self.send_json({"type": "answer_result", **result})
            next_id = result.get("next_question_id")
            if next_id:
                question = await self._get_question(next_id)
                if question:
                    await self._send_question(question)
            elif result.get("session_state") in ("COMPLETED", "REVIEW_REQUIRED"):
                await self.send_json(
                    {
                        "type": "complete",
                        "state": result.get("session_state"),
                        "message": "Viva complete. AI evaluation is running in the background.",
                    }
                )
        elif action in ("ping", "refresh"):
            question = await self._current_open_question()
            if question:
                await self._send_question(question)
            else:
                session = await self._get_session()
                await self.send_json({"type": "pong", "state": session.state if session else None})

    async def viva_event(self, event):
        await self.send_json(event["data"])

    @database_sync_to_async
    def _get_session(self):
        try:
            return VivaSession.objects.select_related("assignment__course__organization", "student").get(
                pk=self.session_id
            )
        except VivaSession.DoesNotExist:
            return None

    @database_sync_to_async
    def _current_open_question(self):
        session = VivaSession.objects.get(pk=self.session_id)
        if session.state not in (VivaSession.State.IN_PROGRESS, VivaSession.State.READY):
            return None
        for question in session.questions.prefetch_related("attempts__answers").order_by("sequence"):
            attempt = question.attempts.order_by("-attempt_number").first()
            answered = bool(attempt and attempt.answers.exists())
            if not answered:
                return question
        return session.questions.order_by("-sequence").first()

    @database_sync_to_async
    def _ensure_started(self):
        session = VivaSession.objects.get(pk=self.session_id)
        org = session.assignment.course.organization
        orch = VivaOrchestrator(session, org)
        if session.state in (VivaSession.State.CREATED, VivaSession.State.PREPARING):
            orch.prepare()
            session.refresh_from_db()
        if session.state == VivaSession.State.READY:
            orch.start()
            session.refresh_from_db()
        if session.state == VivaSession.State.IN_PROGRESS and not session.questions.exists():
            orch._ask_next_question()
            session.refresh_from_db()
        for question in session.questions.prefetch_related("attempts__answers").order_by("sequence"):
            attempt = question.attempts.order_by("-attempt_number").first()
            if not (attempt and attempt.answers.exists()):
                return question
        return session.questions.order_by("sequence").first()

    @database_sync_to_async
    def _submit_answer(self, question_id, text, input_mode):
        session = VivaSession.objects.get(pk=self.session_id)
        org = session.assignment.course.organization
        orchestrator = VivaOrchestrator(session, org)
        return orchestrator.submit_answer(question_id, text, input_mode=input_mode)

    @database_sync_to_async
    def _current_question_id(self):
        q = VivaQuestion.objects.filter(session_id=self.session_id).order_by("-sequence").first()
        return str(q.id) if q else None

    @database_sync_to_async
    def _get_question(self, question_id):
        try:
            return VivaQuestion.objects.get(pk=question_id)
        except VivaQuestion.DoesNotExist:
            return None
