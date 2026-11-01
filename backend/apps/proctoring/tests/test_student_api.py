from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.accounts.tests.helpers import create_student, create_workspace
from apps.assessments.models import Exam, ExamAttempt
from apps.courses.tests.helpers import create_course
from apps.proctoring.models import ProctoringEvent
from apps.proctoring.student_views import BrowserEventView, FrameUploadView
from apps.proctoring.tests.helpers import make_image_bytes
from apps.proctoring.throttles import (
    ProctoringBrowserEventThrottle,
    ProctoringFrameThrottle,
)
from apps.proctoring.vision_adapter import InvalidFrameError


class StudentProctoringApiTests(APITestCase):
    def setUp(self):
        self.workspace = create_workspace("alpha")
        self.other_workspace = create_workspace("beta")
        self.student = create_student(
            self.workspace,
            email="student@example.com",
            approval_status=User.ApprovalStatus.APPROVED,
        )
        self.other_student = create_student(
            self.workspace,
            email="other@example.com",
            approval_status=User.ApprovalStatus.APPROVED,
        )
        self.student_b = create_student(
            self.other_workspace,
            email="student-b@example.com",
            approval_status=User.ApprovalStatus.APPROVED,
        )
        course = create_course(self.workspace)
        other_course = create_course(self.other_workspace)
        exam = Exam.objects.create(
            workspace=self.workspace,
            course=course,
            title="Proctored exam",
            duration_minutes=60,
            proctoring_enabled=True,
        )
        other_exam = Exam.objects.create(
            workspace=self.other_workspace,
            course=other_course,
            title="Other exam",
            duration_minutes=60,
            proctoring_enabled=True,
        )
        self.attempt = ExamAttempt.objects.create(
            workspace=self.workspace,
            exam=exam,
            student=self.student,
            consent_given_at=timezone.now(),
        )
        self.other_attempt = ExamAttempt.objects.create(
            workspace=self.other_workspace,
            exam=other_exam,
            student=self.student_b,
        )

    def frame_url(self, attempt=None, slug="alpha"):
        attempt = attempt or self.attempt
        return f"/api/v1/workspaces/{slug}/attempts/{attempt.pk}/frames/"

    def event_url(self, attempt=None, slug="alpha"):
        attempt = attempt or self.attempt
        return f"/api/v1/workspaces/{slug}/attempts/{attempt.pk}/browser-events/"

    def image_upload(self, content=None, name="frame.jpg", mime="image/jpeg"):
        if content is None:
            content = make_image_bytes("JPEG")
        return SimpleUploadedFile(name, content, content_type=mime)

    def post_frame(self, upload=None, **kwargs):
        return self.client.post(
            self.frame_url(**kwargs),
            {"image": upload or self.image_upload()},
            format="multipart",
        )

    def post_event(self, body=None, **kwargs):
        body = {"type": "tab_hidden"} if body is None else body
        return self.client.post(self.event_url(**kwargs), body, format="json")

    # ---- frames ----

    def test_frame_upload_calls_service_and_returns_ok(self):
        self.client.force_login(self.student)
        data = make_image_bytes("JPEG")
        with patch(
            "apps.proctoring.student_views.process_frame", return_value=2
        ) as process:
            response = self.post_frame(self.image_upload(content=data))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"ok": True})
        process.assert_called_once_with(self.attempt, data, "image/jpeg")

    def test_png_is_accepted_and_type_comes_from_the_content(self):
        self.client.force_login(self.student)
        png = make_image_bytes("PNG")
        with patch("apps.proctoring.student_views.process_frame") as process:
            response = self.post_frame(self.image_upload(png, "f.png", "image/png"))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            process.assert_called_once_with(self.attempt, png, "image/png")
        jpeg = make_image_bytes("JPEG")
        with patch("apps.proctoring.student_views.process_frame") as process:
            response = self.post_frame(self.image_upload(jpeg, "f.png", "image/png"))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            process.assert_called_once_with(self.attempt, jpeg, "image/jpeg")

    def test_invalid_frame_error_becomes_bad_request(self):
        self.client.force_login(self.student)
        with patch(
            "apps.proctoring.student_views.process_frame",
            side_effect=InvalidFrameError("Invalid image data."),
        ):
            response = self.post_frame()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data)

    def test_frame_rejects_bad_content(self):
        self.client.force_login(self.student)
        with patch("apps.proctoring.student_views.process_frame") as process:
            not_an_image = self.post_frame(
                self.image_upload(b"not an image", "frame.jpg", "image/jpeg")
            )
            gif = self.post_frame(
                self.image_upload(make_image_bytes("GIF"), "frame.jpg", "image/jpeg")
            )
            empty = self.post_frame(self.image_upload(b"", "frame.jpg"))
            missing = self.client.post(self.frame_url(), {}, format="multipart")
        for response in (not_an_image, gif, empty, missing):
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        process.assert_not_called()

    def test_frame_rejects_oversized_and_too_many_pixels(self):
        self.client.force_login(self.student)
        with override_settings(PROCTORING_FRAME_MAX_BYTES=2):
            oversized = self.post_frame()
        self.assertEqual(oversized.status_code, status.HTTP_400_BAD_REQUEST)
        with override_settings(PROCTORING_FRAME_MAX_PIXELS=10):
            too_big = self.post_frame()
        self.assertEqual(too_big.status_code, status.HTTP_400_BAD_REQUEST)

    # ---- browser events ----

    def test_browser_event_is_stored_as_tab_switch_from_the_browser(self):
        self.client.force_login(self.student)
        response = self.post_event({"type": "tab_hidden", "duration_seconds": 5})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data, {"ok": True})
        event = ProctoringEvent.objects.get(attempt=self.attempt)
        self.assertEqual(event.event_type, ProctoringEvent.EventType.TAB_SWITCH)
        self.assertEqual(event.severity, ProctoringEvent.Severity.WARNING)
        self.assertEqual(event.details["source"], "browser")
        self.assertEqual(event.details["duration_seconds"], 5)

    def test_browser_event_rejects_other_types(self):
        self.client.force_login(self.student)
        for body in ({"type": "face_missing"}, {"type": "tab_switch"}, {}):
            response = self.post_event(body)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ProctoringEvent.objects.count(), 0)

    def test_browser_event_rejects_bad_duration(self):
        self.client.force_login(self.student)
        for value in (-1, 86401):
            response = self.post_event({"type": "tab_hidden", "duration_seconds": value})
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_browser_event_started_at_limits(self):
        self.client.force_login(self.student)
        future = (timezone.now() + timedelta(minutes=5)).isoformat()
        before_start = (self.attempt.started_at - timedelta(hours=1)).isoformat()
        for value in (future, before_start):
            response = self.post_event({"type": "tab_hidden", "started_at": value})
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        valid = self.attempt.started_at + timedelta(seconds=1)
        response = self.post_event(
            {"type": "tab_hidden", "started_at": valid.isoformat()}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProctoringEvent.objects.get().occurred_at, valid)

    # ---- shared checks (both endpoints) ----

    def test_attempts_are_scoped_to_workspace_and_student(self):
        self.client.force_login(self.student)
        self.assertEqual(
            self.post_frame(attempt=self.other_attempt, slug="beta").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.post_event(attempt=self.attempt).status_code,
            status.HTTP_201_CREATED,
        )
        self.client.force_login(self.other_student)
        self.assertEqual(
            self.post_event(attempt=self.attempt).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.post_frame(attempt=self.attempt).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.post_event(attempt=self.other_attempt, slug="alpha").status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_expired_or_finished_attempt_is_forbidden(self):
        self.client.force_login(self.student)
        self.attempt.started_at = timezone.now() - timedelta(minutes=61)
        self.attempt.save(update_fields=["started_at"])
        self.assertEqual(self.post_event().status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.post_frame().status_code, status.HTTP_403_FORBIDDEN)

        self.attempt.started_at = timezone.now()
        self.attempt.status = ExamAttempt.Status.SUBMITTED
        self.attempt.save(update_fields=["started_at", "status"])
        self.assertEqual(self.post_event().status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.post_frame().status_code, status.HTTP_403_FORBIDDEN)

    def test_missing_consent_is_forbidden(self):
        self.attempt.consent_given_at = None
        self.attempt.save(update_fields=["consent_given_at"])
        self.client.force_login(self.student)
        with patch("apps.proctoring.student_views.process_frame") as process:
            frame = self.post_frame()
        event = self.post_event()
        self.assertEqual(frame.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(event.status_code, status.HTTP_403_FORBIDDEN)
        process.assert_not_called()
        self.assertEqual(ProctoringEvent.objects.count(), 0)

    def test_unproctored_attempt_is_rejected(self):
        self.attempt.exam.proctoring_enabled = False
        self.attempt.exam.save(update_fields=["proctoring_enabled"])
        self.client.force_login(self.student)
        self.assertEqual(self.post_event().status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.post_frame().status_code, status.HTTP_400_BAD_REQUEST)

    def test_throttles_use_the_configured_scopes(self):
        self.assertEqual(ProctoringFrameThrottle.scope, "proctoring_frame")
        self.assertEqual(
            ProctoringBrowserEventThrottle.scope, "proctoring_browser_event"
        )
        self.assertEqual(FrameUploadView.throttle_classes, [ProctoringFrameThrottle])
        self.assertEqual(
            BrowserEventView.throttle_classes, [ProctoringBrowserEventThrottle]
        )