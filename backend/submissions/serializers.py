import hashlib
import logging
import uuid

from django.db import IntegrityError, transaction
from django.db.models import Max
from rest_framework import serializers

from submissions.models import Submission, SubmissionFile
from submissions.pipeline import _detect_file_type

logger = logging.getLogger(__name__)


class SubmissionFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionFile
        fields = (
            "id",
            "original_filename",
            "content_type",
            "file_type",
            "size_bytes",
            "storage_key",
            "checksum",
            "created_at",
        )
        read_only_fields = fields


class SubmissionSerializer(serializers.ModelSerializer):
    files = SubmissionFileSerializer(many=True, read_only=True)
    student_email = serializers.EmailField(source="student.email", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)

    class Meta:
        model = Submission
        fields = (
            "id",
            "assignment",
            "assignment_title",
            "student",
            "student_email",
            "student_name",
            "status",
            "github_url",
            "metadata",
            "knowledge_representation",
            "processing_error",
            "processed_at",
            "version",
            "files",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "student",
            "status",
            "knowledge_representation",
            "processing_error",
            "processed_at",
            "files",
            "created_at",
            "updated_at",
        )


class SubmissionCreateSerializer(serializers.Serializer):
    assignment = serializers.UUIDField()
    github_url = serializers.URLField(required=False, allow_blank=True)
    file = serializers.FileField(required=False)
    files = serializers.ListField(child=serializers.FileField(), required=False)

    def validate(self, attrs):
        if not attrs.get("file") and not attrs.get("files") and not attrs.get("github_url"):
            raise serializers.ValidationError("Provide a file upload and/or a GitHub URL.")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        from assignments.models import Assignment
        from common.storage import upload_fileobj

        request = self.context["request"]
        try:
            assignment = Assignment.objects.select_related("course__organization").get(
                pk=validated_data["assignment"],
                course__organization_id=request.user.active_organization_id,
            )
        except Assignment.DoesNotExist as exc:
            raise serializers.ValidationError({"assignment": "Assignment not found in this organization."}) from exc

        next_version = (
            Submission.objects.filter(assignment=assignment, student=request.user).aggregate(v=Max("version"))["v"]
            or 0
        ) + 1

        try:
            submission = Submission.objects.create(
                assignment=assignment,
                student=request.user,
                github_url=validated_data.get("github_url", "") or "",
                status=Submission.Status.UPLOADED,
                version=next_version,
            )
        except IntegrityError as exc:
            logger.exception("Submission create integrity error")
            raise serializers.ValidationError(
                "A submission with this version already exists. Refresh and try again."
            ) from exc

        uploads = []
        if validated_data.get("file"):
            uploads.append(validated_data["file"])
        uploads.extend(validated_data.get("files") or [])

        org_id = assignment.course.organization_id
        for f in uploads:
            file_type = _detect_file_type(f.name, getattr(f, "content_type", "") or "")
            key = f"orgs/{org_id}/submissions/{submission.id}/{uuid.uuid4()}-{f.name}"
            # Read bytes first (upload_fileobj consumes the stream)
            raw = f.read()
            f.seek(0)
            try:
                from io import BytesIO

                upload_fileobj(BytesIO(raw), key, content_type=getattr(f, "content_type", None))
            except Exception as exc:
                logger.exception("MinIO upload failed for submission %s", submission.id)
                submission.status = Submission.Status.FAILED
                submission.processing_error = f"Object storage upload failed: {exc}"
                submission.save(update_fields=["status", "processing_error", "updated_at"])
                raise serializers.ValidationError(
                    "File upload to storage failed. Check MinIO is running and try again."
                ) from exc
            SubmissionFile.objects.create(
                submission=submission,
                original_filename=f.name,
                content_type=getattr(f, "content_type", "") or "",
                file_type=file_type,
                size_bytes=len(raw),
                storage_key=key,
                checksum=hashlib.sha256(raw).hexdigest(),
            )

        submission.status = Submission.Status.QUEUED
        submission.save(update_fields=["status", "updated_at"])
        from submissions.tasks import process_submission_task

        process_submission_task.delay(str(submission.id))
        return submission
