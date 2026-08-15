from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
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
            .prefetch_related("questions", "integrity_events", "proctor_frames")
        )
        role = getattr(self.request.user, "active_role", None)
        if role == "student":
            qs = qs.filter(student=self.request.user)
        assignment_id = self.request.query_params.get("assignment")
        student_id = self.request.query_params.get("student")
        state = self.request.query_params.get("state")
        integrity = (self.request.query_params.get("integrity") or "").lower()
        if assignment_id:
            qs = qs.filter(assignment_id=assignment_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        if state:
            qs = qs.filter(state=state)
        if integrity in ("1", "true", "yes"):
            qs = qs.filter(config__has_key="integrity_termination")
        return qs.order_by("-created_at")

    def get_permissions(self):
        if self.action in (
            "create",
            "start",
            "answer",
            "speak",
            "finish",
            "transcribe",
            "stt_config",
            "integrity",
            "proctor_frames",
        ):
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

    @action(detail=True, methods=["get"], url_path="stt-config")
    def stt_config(self, request, pk=None):
        """Return STT provider info and project keyterms for Deepgram Nova-3 prompting."""
        from django.conf import settings as dj_settings

        from viva.stt_context import keyterms_for_session

        session = self.get_object()
        provider = (getattr(dj_settings, "STT_PROVIDER", "") or "").lower().strip()
        has_deepgram = bool((getattr(dj_settings, "DEEPGRAM_API_KEY", "") or "").strip())
        if provider in ("", "auto"):
            provider = "deepgram" if has_deepgram else "mock"
        keyterms = keyterms_for_session(session) if provider == "deepgram" else []
        return Response(
            {
                "provider": provider,
                "model": getattr(dj_settings, "DEEPGRAM_STT_MODEL", "nova-3"),
                "keyterms": keyterms,
                "configured": provider == "deepgram" and has_deepgram,
            }
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="transcribe",
        parser_classes=[MultiPartParser, FormParser],
    )
    def transcribe(self, request, pk=None):
        """Transcribe student audio with Deepgram Nova-3, biased by project keyterms."""
        session = self.get_object()
        upload = request.FILES.get("audio") or request.FILES.get("file")
        if not upload:
            return Response({"detail": "audio file is required."}, status=status.HTTP_400_BAD_REQUEST)

        audio_bytes = upload.read()
        if not audio_bytes:
            return Response({"detail": "audio file was empty."}, status=status.HTTP_400_BAD_REQUEST)
        max_bytes = 8 * 1024 * 1024
        if len(audio_bytes) > max_bytes:
            return Response({"detail": "audio file is too large."}, status=status.HTTP_400_BAD_REQUEST)

        content_type = (getattr(upload, "content_type", None) or "audio/webm").split(";")[0].strip()
        if content_type in ("application/octet-stream", ""):
            name = (getattr(upload, "name", "") or "").lower()
            if name.endswith(".wav"):
                content_type = "audio/wav"
            elif name.endswith(".mp3"):
                content_type = "audio/mpeg"
            elif name.endswith(".ogg"):
                content_type = "audio/ogg"
            else:
                content_type = "audio/webm"

        from ai.providers import get_stt_provider
        from viva.stt_context import keyterms_for_session

        keyterms = keyterms_for_session(session)
        try:
            provider = get_stt_provider()
            text = provider.transcribe(audio_bytes, content_type, keyterms=keyterms)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(
            {
                "text": (text or "").strip(),
                "keyterms_used": len(keyterms),
                "provider": provider.__class__.__name__,
            }
        )

    @action(detail=True, methods=["post"], url_path="speak")
    def speak(self, request, pk=None):
        """Synthesize examiner question audio (Rumik Mulberry WAV when configured)."""
        from django.conf import settings as dj_settings

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
                config = dict(session.config or {})
                locked = str(config.get("examiner_speaker") or "").lower().strip()

                if speaker and speaker not in ALLOWED_SPEAKERS:
                    return Response(
                        {"detail": f"speaker must be one of: {', '.join(sorted(ALLOWED_SPEAKERS))}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Lock voice for the whole viva: first valid speaker wins; later requests reuse it.
                if locked in ALLOWED_SPEAKERS:
                    speaker = locked
                elif speaker in ALLOWED_SPEAKERS:
                    config["examiner_speaker"] = speaker
                    session.config = config
                    session.save(update_fields=["config", "updated_at"])
                else:
                    speaker = str(
                        getattr(dj_settings, "RUMIK_TTS_DEFAULT_SPEAKER", "siya") or "siya"
                    ).lower().strip()
                    if speaker not in ALLOWED_SPEAKERS:
                        speaker = "siya"

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

    @action(detail=True, methods=["post"], url_path="integrity")
    def integrity(self, request, pk=None):
        """Record a proctoring event; grace_expired terminates the viva without evaluation."""
        from django.utils.dateparse import parse_datetime

        from viva.models import VivaIntegrityEvent

        session = self.get_object()
        event_type = str(request.data.get("event_type") or "").strip()
        valid = {choice.value for choice in VivaIntegrityEvent.EventType}
        if event_type not in valid:
            return Response(
                {"detail": f"event_type must be one of: {', '.join(sorted(valid))}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        client_ts = request.data.get("client_ts")
        parsed_ts = parse_datetime(str(client_ts)) if client_ts else None
        metadata = request.data.get("metadata") if isinstance(request.data.get("metadata"), dict) else {}
        event = VivaIntegrityEvent.objects.create(
            session=session,
            event_type=event_type,
            client_ts=parsed_ts,
            metadata=metadata,
        )
        org = Organization.objects.get(pk=self.get_organization_id())
        log_audit(
            org,
            request.user,
            f"viva.integrity.{event_type}",
            "viva_session",
            str(session.id),
            request=request,
            metadata={"event_id": str(event.id), **metadata},
        )

        if event_type in (VivaIntegrityEvent.EventType.GRACE_EXPIRED, VivaIntegrityEvent.EventType.CAMERA_DENIED):
            if session.state not in (
                VivaSession.State.COMPLETED,
                VivaSession.State.REVIEW_REQUIRED,
                VivaSession.State.FAILED,
            ):
                orchestrator = VivaOrchestrator(session, org)
                orchestrator.terminate_integrity(reason=event_type, metadata=metadata)
                session.refresh_from_db()

        return Response(
            {
                "event_id": str(event.id),
                "event_type": event_type,
                "session": VivaSessionSerializer(session, context={"request": request}).data,
            }
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="proctor-frames",
        parser_classes=[MultiPartParser, FormParser],
    )
    def proctor_frames(self, request, pk=None):
        """Accept a monitoring snapshot for instructor review."""
        from io import BytesIO

        from django.utils import timezone

        from common.storage import upload_fileobj
        from viva.models import VivaIntegrityEvent, VivaProctorFrame

        session = self.get_object()
        if session.state != VivaSession.State.IN_PROGRESS:
            return Response(
                {"detail": "Snapshots are only accepted during an in-progress viva."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        upload = request.FILES.get("frame") or request.FILES.get("image") or request.FILES.get("file")
        if not upload:
            return Response({"detail": "frame image is required."}, status=status.HTTP_400_BAD_REQUEST)
        content_type = (getattr(upload, "content_type", None) or "image/jpeg").split(";")[0].strip()
        if content_type not in ("image/jpeg", "image/jpg", "image/png", "image/webp"):
            return Response({"detail": "frame must be a JPEG, PNG, or WebP image."}, status=status.HTTP_400_BAD_REQUEST)
        payload = upload.read()
        if not payload:
            return Response({"detail": "frame was empty."}, status=status.HTTP_400_BAD_REQUEST)
        if len(payload) > 400 * 1024:
            return Response({"detail": "frame is too large."}, status=status.HTTP_400_BAD_REQUEST)

        last = session.proctor_frames.order_by("-captured_at").first()
        if last and last.captured_at and (timezone.now() - last.captured_at).total_seconds() < 12:
            return Response({"detail": "Too many snapshots. Try again shortly."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if session.proctor_frames.count() >= 90:
            return Response({"detail": "Snapshot limit reached for this session."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        key = f"proctor/{session.id}/{timezone.now().strftime('%Y%m%dT%H%M%S')}.jpg"
        try:
            upload_fileobj(BytesIO(payload), key, content_type=content_type)
        except Exception as exc:
            return Response({"detail": f"Could not store snapshot: {exc}"}, status=status.HTTP_502_BAD_GATEWAY)

        frame = VivaProctorFrame.objects.create(
            session=session,
            storage_key=key,
            content_type=content_type,
            byte_size=len(payload),
        )
        VivaIntegrityEvent.objects.create(
            session=session,
            event_type=VivaIntegrityEvent.EventType.FRAME_UPLOADED,
            metadata={"frame_id": str(frame.id), "byte_size": len(payload)},
        )
        return Response({"id": str(frame.id), "captured_at": frame.captured_at})

