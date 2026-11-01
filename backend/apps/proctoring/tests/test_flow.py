"""End-to-end proctoring flow across the student and teacher sides.

Uses the real endpoints, services and close hook. Only the vision backend
is replaced by a scripted one, so no cv2 or mediapipe is needed.
"""

from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.accounts.tests.helpers import create_student, create_teacher, create_workspace
from apps.assessments.models import Exam, ExamAttempt
from apps.courses.tests.helpers import create_course
from apps.enrollments.models import CourseEnrollment
from apps.enrollments.tests.helpers import create_enrollment
from apps.payments.tests.helpers import TemporaryMediaMixin
from apps.proctoring.models import ProctoringEvent
from apps.proctoring.tests.helpers import make_image_bytes
from apps.proctoring.vision_adapter import DetectedEvent
from apps.assessments.tests.helpers import create_exam

FRAME_BYTES = make_image_bytes()
# Name of the multipart field of Track B's frame endpoint.
FRAME_FIELD = "image"


class ScriptedVisionBackend:
    """Returns one confirmed event per frame, and one last event at finish."""

    def process_frame(self, attempt, image_bytes, content_type):
        return [
            DetectedEvent(
                event_type="face_missing",
                occurred_at=timezone.now(),
                duration_seconds=4,
                confidence=0.9,
                wants_snapshot=True,
            )
        ]

    def finish(self, attempt):
        return [
            DetectedEvent(
                event_type="looking_away",
                occurred_at=timezone.now(),
                duration_seconds=2,
                confidence=0.7,
                wants_snapshot=False,
            )
        ]


class ProctoringFlowTests(TemporaryMediaMixin, APITestCase):
    def setUp(self):
        self.workspace = create_workspace("alpha")
        self.other_workspace = create_workspace("beta")
        self.teacher = create_teacher(self.workspace, email="teacher-a@example.com")
        self.other_teacher = create_teacher(
            self.other_workspace, email="teacher-b@example.com"
        )
        self.student = create_student(
            self.workspace,
            email="student@example.com",
            approval_status=User.ApprovalStatus.APPROVED,
        )
        course = create_course(self.workspace)
        create_enrollment(
            self.workspace, self.student, course, status=CourseEnrollment.Status.ACTIVE
        )
        self.exam = create_exam(
            self.workspace,
            course,
            title="Proctored exam",
            status=Exam.Status.PUBLISHED,
            duration_minutes=60,
            proctoring_enabled=True,
        )

    def api(self, name, **kwargs):
        return reverse(name, kwargs={"slug": "alpha", **kwargs})

    def test_full_flow_from_consent_to_teacher_review(self):
        backend = ScriptedVisionBackend()
        with patch("apps.proctoring.services._get_backend", return_value=backend):
            # 1. The student starts the attempt and gives consent.
            self.client.force_login(self.student)
            start = self.client.post(
                self.api("exam-attempt-start", exam_id=self.exam.pk),
                {"consent": True},
                format="json",
            )
            self.assertEqual(start.status_code, status.HTTP_201_CREATED)
            attempt = ExamAttempt.objects.get(pk=start.data["id"])
            self.assertIsNotNone(attempt.consent_given_at)

            # 2. One frame is analysed: an event and its snapshot are saved.
            frame = self.client.post(
                self.api("proctoring-frame-upload", attempt_id=attempt.pk),
                {
                    FRAME_FIELD: SimpleUploadedFile(
                        "frame.jpg", FRAME_BYTES, content_type="image/jpeg"
                    )
                },
                format="multipart",
            )
            self.assertEqual(frame.status_code, status.HTTP_200_OK)
            self.assertEqual(ProctoringEvent.objects.filter(attempt=attempt).count(), 1)

            # 3. Submitting closes the vision session and saves the last event.
            with self.captureOnCommitCallbacks(execute=True):
                submit = self.client.post(
                    self.api("exam-attempt-submit", attempt_id=attempt.pk)
                )
            self.assertEqual(submit.status_code, status.HTTP_200_OK)
            self.assertEqual(ProctoringEvent.objects.filter(attempt=attempt).count(), 2)

        # 4. The student can never reach the teacher side.
        event = ProctoringEvent.objects.get(
            attempt=attempt, event_type="face_missing"
        )
        evidence = event.evidence.get()
        teacher_urls = [
            self.api("proctoring-attempt-events", attempt_id=attempt.pk),
            self.api("proctoring-event-detail", event_id=event.pk),
            self.api("proctoring-evidence-file", evidence_id=evidence.pk),
        ]
        for url in teacher_urls:
            self.assertEqual(
                self.client.get(url).status_code, status.HTTP_403_FORBIDDEN, url
            )
        self.assertEqual(
            self.client.post(
                self.api("proctoring-event-review", event_id=event.pk),
                {"review_status": "dismissed"},
                format="json",
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )

        # 5. A teacher of another workspace is refused too.
        self.client.force_login(self.other_teacher)
        for url in teacher_urls:
            self.assertEqual(
                self.client.get(url).status_code, status.HTTP_403_FORBIDDEN, url
            )

        # 6. The workspace teacher lists the events and sees the snapshot.
        self.client.force_login(self.teacher)
        listing = self.client.get(
            self.api("proctoring-attempt-events", attempt_id=attempt.pk)
        )
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data["count"], 2)
        listed = {item["event_type"]: item for item in listing.data["results"]}
        self.assertEqual(len(listed["face_missing"]["evidence"]), 1)
        self.assertEqual(listed["looking_away"]["evidence"], [])

        file_url = listed["face_missing"]["evidence"][0]["file_url"]
        snapshot = self.client.get(file_url)
        self.assertEqual(snapshot.status_code, status.HTTP_200_OK)
        self.assertEqual(b"".join(snapshot.streaming_content), FRAME_BYTES)

        # 7. The teacher reviews one event. The attempt itself is not judged.
        review = self.client.post(
            self.api("proctoring-event-review", event_id=event.pk),
            {"review_status": "violation"},
            format="json",
        )
        self.assertEqual(review.status_code, status.HTTP_200_OK)
        self.assertEqual(review.data["reviewed_by"], self.teacher.pk)
        pending = self.client.get(
            self.api("proctoring-attempt-events", attempt_id=attempt.pk),
            {"review_status": "pending"},
        )
        self.assertEqual(pending.data["count"], 1)
        attempt.refresh_from_db()
        self.assertEqual(
            attempt.proctoring_review_status, ExamAttempt.ReviewStatus.CLEAN
        )
