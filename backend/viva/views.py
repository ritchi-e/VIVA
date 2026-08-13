from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from audit.services import log_audit
from common.permissions import IsStudent
from common.tenancy import TenantContextMixin
from orgs.models import Organization
from submissions.models import Submission
from viva.models import VivaQuestion, VivaSession
from viva.orchestrator import VivaOrchestrator
from viva.serializers import (
    AnswerSubmitSerializer,
    VivaSessionCreateSerializer,
    VivaSessionSerializer,
)


class VivaSessionViewSet(TenantContextMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return VivaSessionCreateSerializer
        return VivaSessionSerializer

    def get_queryset(self):
        org_id = self.get_organization_id()
        qs = (
            VivaSession.objects.filter(assignment__course__organization_id=org_id)
            .select_related("student", "assignment", "submission")
            .prefetch_related("questions")
        )
        role = getattr(self.request.user, "active_role", None)
        if role == "student":
            qs = qs.filter(student=self.request.user)
        assignment_id = self.request.query_params.get("assignment")
        student_id = self.request.query_params.get("student")
        state = self.request.query_params.get("state")
        if assignment_id:
            qs = qs.filter(assignment_id=assignment_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        if state:
            qs = qs.filter(state=state)
        return qs.order_by("-created_at")

    def get_permissions(self):
        if self.action in ("create", "start", "answer", "speak", "finish"):
            return [IsAuthenticated(), IsStudent()]
        return super().get_permissions()

    def perform_create(self, serializer):
        submission_id = self.request.data.get("submission")
        submission = Submission.objects.get(
            pk=submission_id,
            student=self.request.user,
            assignment__course__organization_id=self.get_organization_id(),
        )
        viva_config = submission.assignment.viva_config or {}
        budget = viva_config.get("question_budget")
        save_kwargs = {
            "student": self.request.user,
            "submission": submission,
            "assignment": submission.assignment,
        }
        if isinstance(budget, int) and budget > 0 and "question_budget" not in serializer.validated_data:
            save_kwargs["question_budget"] = budget
        session = serializer.save(**save_kwargs)
        log_audit(
            Organization.objects.get(pk=self.get_organization_id()),
            self.request.user,
            "viva.create",
            "viva_session",
            str(session.id),
            request=self.request,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        session = serializer.instance
        # Return full session payload (includes id) for the SPA redirect
        return Response(VivaSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        session = self.get_object()
        org = Organization.objects.get(pk=self.get_organization_id())
        orchestrator = VivaOrchestrator(session, org)
        orchestrator.start()
        session.refresh_from_db()
        return Response(VivaSessionSerializer(session).data)

    @action(detail=True, methods=["post"])
    def answer(self, request, pk=None):
        session = self.get_object()
        ser = AnswerSubmitSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        org = Organization.objects.get(pk=self.get_organization_id())
        orchestrator = VivaOrchestrator(session, org)
        result = orchestrator.submit_answer(
            ser.validated_data["question_id"],
            ser.validated_data["text"],
            input_mode=ser.validated_data.get("input_mode", "text"),
        )
        session.refresh_from_db()
        return Response({**result, "session": VivaSessionSerializer(session).data})

    @action(detail=True, methods=["post"])
    def prepare(self, request, pk=None):
        session = self.get_object()
        org = Organization.objects.get(pk=self.get_organization_id())
        VivaOrchestrator(session, org).prepare()
        session.refresh_from_db()
        return Response(VivaSessionSerializer(session).data)

    @action(detail=True, methods=["get"], url_path="questions")
    def questions(self, request, pk=None):
        session = self.get_object()
        from viva.serializers import VivaQuestionSerializer

        qs = session.questions.prefetch_related("attempts__answers__evaluation").order_by("sequence")
        return Response(VivaQuestionSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="speak")
    def speak(self, request, pk=None):
        """Synthesize examiner question audio (Rumik Mulberry WAV when configured)."""
        session = self.get_object()
        question_id = request.data.get("question_id")
        text = (request.data.get("text") or "").strip()
        speaker = (request.data.get("speaker") or request.data.get("voice") or "").strip().lower()
        if question_id:
            question = VivaQuestion.objects.get(pk=question_id, session=session)
            text = question.question_text
        if not text:
            return Response({"detail": "question_id or text is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from ai.providers import get_tts_provider
            from ai.providers.rumik_provider import ALLOWED_SPEAKERS, RumikTTSProvider

            provider = get_tts_provider()
            kwargs = {}
            if isinstance(provider, RumikTTSProvider):
                if speaker and speaker not in ALLOWED_SPEAKERS:
                    return Response(
                        {"detail": f"speaker must be one of: {', '.join(sorted(ALLOWED_SPEAKERS))}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if speaker:
                    kwargs["speaker"] = speaker
            audio = provider.synthesize(text, **kwargs)
            content_type = "audio/wav" if isinstance(provider, RumikTTSProvider) else "audio/mpeg"
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return HttpResponse(audio, content_type=content_type)

    @action(detail=True, methods=["post"])
    def finish(self, request, pk=None):
        """End the viva early and process answers recorded so far."""
        session = self.get_object()
        org = Organization.objects.get(pk=self.get_organization_id())
        orchestrator = VivaOrchestrator(session, org)

        if session.state in (VivaSession.State.COMPLETED, VivaSession.State.REVIEW_REQUIRED):
            return Response(VivaSessionSerializer(session).data)

        if session.state == VivaSession.State.READY:
            orchestrator.start()
            session.refresh_from_db()

        if session.state != VivaSession.State.IN_PROGRESS:
            return Response(
                {"detail": f"Cannot finish viva in state {session.state}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Optional: save in-progress answer before closing the session.
        question_id = request.data.get("question_id")
        text = (request.data.get("text") or "").strip()
        if question_id and text:
            try:
                orchestrator.submit_answer(question_id, text, input_mode="voice")
                session.refresh_from_db()
            except ValueError:
                pass

        if session.state == VivaSession.State.IN_PROGRESS:
            orchestrator.complete()
            session.refresh_from_db()

        log_audit(
            org,
            request.user,
            "viva.finish",
            "viva_session",
            str(session.id),
            request=request,
        )
        return Response(VivaSessionSerializer(session).data)
