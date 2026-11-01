from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsApprovedStudent, WorkspaceSlugMixin
from apps.assessments.attempt_services import attempt_end_time
from apps.assessments.models import ExamAttempt

from .services import process_frame, record_event
from .student_serializers import (
    BrowserEventSerializer,
    FrameUploadSerializer,
    OkResponseSerializer,
)
from .throttles import ProctoringBrowserEventThrottle, ProctoringFrameThrottle
from .vision_adapter import BROWSER_EVENT_TYPES, DetectedEvent, InvalidFrameError


class StudentProctoringAttemptView(WorkspaceSlugMixin, APIView):
    permission_classes = [IsApprovedStudent]
    closed_message = "This attempt is not accepting frames."

    def get_attempt(self, request, attempt_id):
        """Checks 2 to 5 of the spec, cheapest first."""
        attempt = (
            ExamAttempt.objects.select_related("exam")
            .filter(
                workspace=self.workspace,
                student=request.user,
                pk=attempt_id,
            )
            .first()
        )
        if attempt is None:
            raise NotFound("Attempt not found.")
        if not attempt.exam.proctoring_enabled:
            raise ValidationError({"detail": "Proctoring is not enabled."})
        if (
            attempt.status != ExamAttempt.Status.IN_PROGRESS
            or attempt_end_time(attempt) <= timezone.now()
        ):
            raise PermissionDenied(self.closed_message)
        if attempt.consent_given_at is None:
            raise PermissionDenied("Consent has not been given for this attempt.")
        return attempt


class FrameUploadView(StudentProctoringAttemptView):
    serializer_class = FrameUploadSerializer
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ProctoringFrameThrottle]

    @extend_schema(
        summary="Upload a proctoring frame",
        request={"multipart/form-data": FrameUploadSerializer},
        responses={200: OkResponseSerializer},
    )
    def post(self, request, slug, attempt_id):
        attempt = self.get_attempt(request, attempt_id)
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            process_frame(
                attempt,
                serializer.validated_data["image_bytes"],
                serializer.validated_data["content_type"],
            )
        except InvalidFrameError as exc:
            raise ValidationError({"image": str(exc)}) from exc
        return Response({"ok": True}, status=status.HTTP_200_OK)


class BrowserEventView(StudentProctoringAttemptView):
    serializer_class = BrowserEventSerializer
    throttle_classes = [ProctoringBrowserEventThrottle]
    closed_message = "This attempt is not accepting events."

    @extend_schema(
        summary="Record a browser proctoring event",
        request=BrowserEventSerializer,
        responses={201: OkResponseSerializer},
    )
    def post(self, request, slug, attempt_id):
        attempt = self.get_attempt(request, attempt_id)
        serializer = self.serializer_class(
            data=request.data, context={"attempt": attempt}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        detected = DetectedEvent(
            event_type=BROWSER_EVENT_TYPES[data["type"]],
            occurred_at=data.get("started_at") or timezone.now(),
            duration_seconds=data.get("duration_seconds"),
            confidence=None,
            wants_snapshot=False,
        )
        record_event(attempt, detected, source="browser")
        return Response({"ok": True}, status=status.HTTP_201_CREATED)