from django.core.files.storage import default_storage
from django.http import FileResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsWorkspaceTeacher, WorkspaceSlugMixin
from apps.assessments.models import ExamAttempt

from .models import ProctoringEvent, ProctoringEvidence
from .review_services import ReviewConflictError, review_event
from .teacher_serializers import ProctoringEventSerializer, ReviewEventSerializer

# Evidence is served inline only for these types; anything else downloads.
INLINE_IMAGE_TYPES = {"image/jpeg", "image/png"}


class TeacherProctoringView(WorkspaceSlugMixin):
    """Shared setup: workspace from the URL slug, teacher only."""

    permission_classes = [IsWorkspaceTeacher]

    def get_serializer_context(self):
        return {"request": self.request, "workspace": self.workspace}

    def events_queryset(self):
        return ProctoringEvent.objects.filter(workspace=self.workspace).prefetch_related(
            "evidence"
        )


def _validated_filter(params, name, enum_class):
    """Return the query value if it is a valid choice, None if absent."""
    value = params.get(name)
    if value is None:
        return None
    if value not in {choice for choice, _label in enum_class.choices}:
        raise ValidationError({name: ["Select a valid choice."]})
    return value


class AttemptEventListView(TeacherProctoringView, generics.ListAPIView):
    serializer_class = ProctoringEventSerializer

    def get_queryset(self):
        attempt_exists = ExamAttempt.objects.filter(
            workspace=self.workspace, pk=self.kwargs["attempt_id"]
        ).exists()
        if not attempt_exists:
            raise NotFound("Attempt not found.")

        queryset = self.events_queryset().filter(attempt_id=self.kwargs["attempt_id"])
        params = self.request.query_params
        for name, field, enum_class in (
            ("review_status", "review_status", ProctoringEvent.ReviewStatus),
            ("event_type", "event_type", ProctoringEvent.EventType),
            ("severity", "severity", ProctoringEvent.Severity),
        ):
            value = _validated_filter(params, name, enum_class)
            if value is not None:
                queryset = queryset.filter(**{field: value})
        return queryset

    @extend_schema(
        summary="List proctoring events of an attempt",
        description=(
            "The workspace teacher lists the signals recorded for one attempt, "
            "oldest first. These are signals for review, not verdicts."
        ),
        parameters=[
            OpenApiParameter(
                name="review_status",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=[value for value, _label in ProctoringEvent.ReviewStatus.choices],
            ),
            OpenApiParameter(
                name="event_type",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=[value for value, _label in ProctoringEvent.EventType.choices],
            ),
            OpenApiParameter(
                name="severity",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=[value for value, _label in ProctoringEvent.Severity.choices],
            ),
        ],
        responses=ProctoringEventSerializer(many=True),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class EventDetailView(TeacherProctoringView, generics.RetrieveAPIView):
    serializer_class = ProctoringEventSerializer
    lookup_url_kwarg = "event_id"

    def get_queryset(self):
        return self.events_queryset()

    @extend_schema(
        summary="Get one proctoring event",
        description="The event with its evidence list. Evidence files are fetched through file_url.",
        responses=ProctoringEventSerializer,
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class EventReviewView(TeacherProctoringView, APIView):
    serializer_class = ReviewEventSerializer

    @extend_schema(
        summary="Review a proctoring event",
        description=(
            "The teacher marks a pending event as dismissed or violation. "
            "The reviewer and time are set by the server. An event that was "
            "already reviewed returns 409."
        ),
        request=ReviewEventSerializer,
        responses={200: ProctoringEventSerializer},
    )
    def post(self, request, slug, event_id):
        body = ReviewEventSerializer(data=request.data)
        body.is_valid(raise_exception=True)

        try:
            event = review_event(
                event_id,
                self.workspace,
                request.user,
                body.validated_data["review_status"],
            )
        except ReviewConflictError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        if event is None:
            raise NotFound("Event not found.")

        event = self.events_queryset().get(pk=event.pk)
        return Response(
            ProctoringEventSerializer(event, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )


class EvidenceFileView(TeacherProctoringView, APIView):
    @extend_schema(
        summary="View a proctoring snapshot",
        description=(
            "Authorized endpoint for the workspace teacher to view stored evidence. "
            "Files are private and never served from a public URL."
        ),
        responses={
            (200, "image/jpeg"): OpenApiResponse(
                response=OpenApiTypes.BINARY, description="Snapshot JPEG image"
            ),
            (200, "image/png"): OpenApiResponse(
                response=OpenApiTypes.BINARY, description="Snapshot PNG image"
            ),
        },
    )
    def get(self, request, slug, evidence_id):
        evidence = ProctoringEvidence.objects.filter(
            workspace=self.workspace, pk=evidence_id
        ).first()
        if evidence is None:
            raise NotFound("Evidence not found.")

        try:
            file_handle = default_storage.open(evidence.storage_key, "rb")
        except (FileNotFoundError, OSError) as exc:
            raise NotFound("Evidence file not found.") from exc

        if evidence.mime_type in INLINE_IMAGE_TYPES:
            content_type = evidence.mime_type
            disposition = "inline"
        else:
            content_type = "application/octet-stream"
            disposition = "attachment"

        response = FileResponse(file_handle, content_type=content_type)
        response["Content-Disposition"] = disposition
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-store"
        return response
