"""RealVisionBackend with a fake `vision` package (no cv2 needed)."""

import sys
import types
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase, override_settings

from apps.proctoring.vision_adapter import (
    InvalidFrameError,
    RealVisionBackend,
    get_vision_backend,
)


class FakeVisionInvalidFrame(ValueError):
    pass


def record(event_type="face_missing", status="opened", start=1000.0):
    return {
        "type": event_type,
        "status": status,
        "start_time": start,
        "end_time": None,
        "duration": 3.0,
        "confidence": 0.8,
        "snapshot_path": None,
        "config_version": "2",
    }


class RealVisionBackendTests(SimpleTestCase):
    def setUp(self):
        self.attempt = SimpleNamespace(pk=7)
        self.calls = []
        self.frame_result = {"events": [], "dropped": False}
        self.finish_result = []

        def process_session_frame(*args, **kwargs):
            self.calls.append((args, kwargs))
            if isinstance(self.frame_result, Exception):
                raise self.frame_result
            return self.frame_result

        def finish_session(session_id):
            self.calls.append(((session_id,), {}))
            if isinstance(self.finish_result, Exception):
                raise self.finish_result
            return self.finish_result

        pipeline = types.ModuleType("vision.pipeline")
        pipeline.InvalidFrameError = FakeVisionInvalidFrame
        pipeline.process_session_frame = process_session_frame
        pipeline.finish_session = finish_session
        package = types.ModuleType("vision")
        package.pipeline = pipeline
        self.enterContext(
            mock.patch.dict(
                sys.modules, {"vision": package, "vision.pipeline": pipeline}
            )
        )
        self.backend = RealVisionBackend()

    def test_opened_event_is_converted(self):
        self.frame_result = {"events": [record()], "dropped": False}
        events = self.backend.process_frame(self.attempt, b"img", "image/jpeg")
        self.assertEqual(len(events), 1)
        event = events[0]
        self.assertEqual(event.event_type, "face_missing")
        self.assertEqual(event.duration_seconds, 3.0)
        self.assertEqual(event.confidence, 0.8)
        self.assertTrue(event.wants_snapshot)
        self.assertEqual(
            event.occurred_at, datetime.fromtimestamp(1000.0, tz=timezone.utc)
        )

    def test_session_id_is_the_attempt_id_and_blur_is_not_requested(self):
        self.backend.process_frame(self.attempt, b"img", "image/jpeg")
        args, kwargs = self.calls[0]
        self.assertEqual(args[0], "7")
        self.assertEqual(args[1], b"img")
        self.assertIs(kwargs["return_blurred_frame"], False)

    def test_closed_events_are_ignored(self):
        self.frame_result = {"events": [record(status="closed")], "dropped": False}
        self.assertEqual(
            self.backend.process_frame(self.attempt, b"img", "image/jpeg"), []
        )

    def test_unknown_types_are_skipped_not_raised(self):
        self.frame_result = {
            "events": [record("exam_terminated"), record("tab_switch"), record()],
            "dropped": False,
        }
        events = self.backend.process_frame(self.attempt, b"img", "image/jpeg")
        self.assertEqual([e.event_type for e in events], ["face_missing"])

    def test_dropped_frame_returns_nothing(self):
        self.frame_result = {
            "events": [record()],
            "dropped": True,
            "reason": "session_lock_timeout",
        }
        self.assertEqual(
            self.backend.process_frame(self.attempt, b"img", "image/jpeg"), []
        )

    def test_vision_invalid_frame_becomes_adapter_invalid_frame(self):
        self.frame_result = FakeVisionInvalidFrame("bad image")
        with self.assertRaises(InvalidFrameError):
            self.backend.process_frame(self.attempt, b"img", "image/jpeg")

    def test_finish_calls_vision_and_ignores_closed_records(self):
        self.finish_result = [record(status="closed")]
        self.assertEqual(self.backend.finish(self.attempt), [])
        self.assertEqual(self.calls[0][0], ("7",))

    def test_finish_timeout_returns_nothing(self):
        self.finish_result = TimeoutError("lock")
        self.assertEqual(self.backend.finish(self.attempt), [])

    @override_settings(PROCTORING_VISION_BACKEND="vision")
    def test_setting_vision_returns_the_real_backend(self):
        self.assertIsInstance(get_vision_backend(), RealVisionBackend)