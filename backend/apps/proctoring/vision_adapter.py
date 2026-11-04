

import logging
from dataclasses import dataclass
from datetime import datetime
from datetime import timezone as dt_timezone

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class InvalidFrameError(ValueError):
    """Raised when the uploaded image cannot be analysed."""


@dataclass
class DetectedEvent:
    event_type: str
    occurred_at: datetime
    duration_seconds: float | None
    confidence: float | None
    wants_snapshot: bool


# Every ProctoringEvent.EventType must be listed here, or record_event
# raises KeyError. The severity values are a first guess: confirm them
# with the lead (open question P5).
SEVERITY_BY_EVENT_TYPE = {
    "face_missing": "warning",
    "multiple_faces": "high",
    "looking_away": "info",
    "phone_detected": "high",
    "tab_switch": "warning",
}

# Browser signal name sent by the frontend -> stored event type (spec P4).
BROWSER_EVENT_TYPES = {"tab_hidden": "tab_switch"}

# Event types the vision package can report. Anything else is skipped.
VISION_EVENT_TYPES = frozenset(
    {"face_missing", "multiple_faces", "looking_away", "phone_detected"}
)
# Event types that get a snapshot saved with them.
SNAPSHOT_EVENT_TYPES = VISION_EVENT_TYPES


class FakeVisionBackend:
    """Default backend: detects nothing, returns no events."""

    def process_frame(self, attempt, image_bytes, content_type):
        return []

    def finish(self, attempt):
        return []


def _detected_from_records(records):
    """Turn vision EventRecords into DetectedEvents.

    Only "opened" records are used: the same event also comes back later as
    "closed", and saving both would store it twice. Unknown types are
    logged by name and skipped.
    """
    detected = []
    for record in records:
        if record.get("status") != "opened":
            continue
        event_type = record.get("type")
        if event_type not in VISION_EVENT_TYPES:
            logger.warning("Skipping unknown vision event type %s", event_type)
            continue
        detected.append(
            DetectedEvent(
                event_type=event_type,
                occurred_at=datetime.fromtimestamp(
                    record["start_time"], tz=dt_timezone.utc
                ),
                duration_seconds=record.get("duration"),
                confidence=record.get("confidence"),
                wants_snapshot=event_type in SNAPSHOT_EVENT_TYPES,
            )
        )
    return detected


class RealVisionBackend:
    """Backend that runs the real vision pipeline."""

    def process_frame(self, attempt, image_bytes, content_type):
        # Lazy import: vision needs cv2, numpy and mediapipe.
        from vision import pipeline

        now = timezone.now()
        try:
            result = pipeline.process_session_frame(
                str(attempt.pk),
                image_bytes,
                now.timestamp(),
                return_blurred_frame=False,
            )
        except pipeline.InvalidFrameError as exc:
            raise InvalidFrameError(str(exc)) from exc
        if result.get("dropped"):
            return []
        return _detected_from_records(result.get("events", []))

    def finish(self, attempt):
        from vision import pipeline

        try:
            records = pipeline.finish_session(str(attempt.pk))
        except TimeoutError:
            logger.warning("Vision session lock timed out for attempt %s", attempt.pk)
            return []
        return _detected_from_records(records)


def get_vision_backend():
    name = getattr(settings, "PROCTORING_VISION_BACKEND", "fake")
    if name == "fake":
        return FakeVisionBackend()
    if name == "vision":
        return RealVisionBackend()
    raise NotImplementedError(f"Unknown vision backend: {name}")