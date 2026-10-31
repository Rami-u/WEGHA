import json

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.accounts.tests.helpers import create_student, create_teacher, create_workspace
from apps.assessments.models import ExamAttempt
from apps.assessments.tests.helpers import create_exam, create_exam_attempt
from apps.courses.tests.helpers import create_course
from apps.payments.tests.helpers import TemporaryMediaMixin
from apps.proctoring.models import ProctoringEvent
from apps.proctoring.tests.helpers import (
    create_proctoring_event,
    create_proctoring_evidence,
)

JPEG_BYTES = b"\xff\xd8\xff\xe0fake-jpeg-bytes"


class TeacherProctoringTestBase(TemporaryMediaMixin, APITestCase):
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
        self.pending_student = create_student(
            self.workspace, email="pending@example.com"
        )
        self.other_student = create_student(
            self.other_workspace,
            email="student-b@example.com",
            approval_status=User.ApprovalStatus.APPROVED,
        )

        self.exam = create_exam(
            self.workspace,
            create_course(self.workspace),
            title="Proctored exam",
            proctoring_enabled=True,
        )
        self.attempt = create_exam_attempt(self.workspace, self.exam, self.student)

        self.other_exam = create_exam(
            self.other_workspace,
            create_course(self.other_workspace),
            title="Other exam",
            proctoring_enabled=True,
        )
        self.other_attempt = create_exam_attempt(
            self.other_workspace, self.other_exam, self.other_student
        )

    def make_event(self, **fields):
        return create_proctoring_event(self.workspace, self.attempt, **fields)

    def make_evidence(self, event, content=JPEG_BYTES, **fields):
        key = default_storage.save(
            f"proctoring/{self.workspace.pk}/{self.attempt.pk}/test.jpg",
            ContentFile(content),
        )
        return create_proctoring_evidence(
            self.workspace, event, storage_key=key, **fields
        )

    def list_url(self, attempt=None, slug="alpha"):
        attempt = attempt or self.attempt
        return f"/api/v1/workspaces/{slug}/attempts/{attempt.pk}/proctoring/events/"

    def detail_url(self, event, slug="alpha"):
        return f"/api/v1/workspaces/{slug}/proctoring/events/{event.pk}/"

    def review_url(self, event, slug="alpha"):
        return f"/api/v1/workspaces/{slug}/proctoring/events/{event.pk}/review/"

    def file_url(self, evidence, slug="alpha"):
        return f"/api/v1/workspaces/{slug}/proctoring/evidence/{evidence.pk}/file/"


class EventListTests(TeacherProctoringTestBase):
    def test_teacher_lists_events_of_attempt_oldest_first(self):
        first = self.make_event(event_type="face_missing")
        second = self.make_event(event_type="tab_switch", severity="warning")
        self.client.force_login(self.teacher)
        response = self.client.get(self.list_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        ids = [item["id"] for item in response.data["results"]]
        self.assertEqual(ids, [first.pk, second.pk])

    def test_response_shape_has_exact_fields_and_no_private_data(self):
        event = self.make_event()
        evidence = self.make_evidence(event)
        self.client.force_login(self.teacher)
        response = self.client.get(self.list_url())
        item = response.data["results"][0]
        self.assertEqual(
            set(item),
            {
                "id", "attempt", "student", "event_type", "severity",
                "occurred_at", "details", "review_status", "reviewed_by",
                "reviewed_at", "evidence",
            },
        )
        self.assertEqual(
            set(item["evidence"][0]),
            {"id", "evidence_type", "mime_type", "file_url"},
        )
        body = json.dumps(response.data, default=str)
        self.assertNotIn("storage_key", body)
        self.assertNotIn(evidence.storage_key, body)
        self.assertNotIn("workspace", item)

    def test_filters_by_review_status_event_type_and_severity(self):
        self.make_event(event_type="face_missing", severity="warning")
        high = self.make_event(event_type="multiple_faces", severity="high")
        self.client.force_login(self.teacher)
        by_type = self.client.get(self.list_url(), {"event_type": "multiple_faces"})
        self.assertEqual([i["id"] for i in by_type.data["results"]], [high.pk])
        by_severity = self.client.get(self.list_url(), {"severity": "high"})
        self.assertEqual([i["id"] for i in by_severity.data["results"]], [high.pk])
        by_status = self.client.get(self.list_url(), {"review_status": "dismissed"})
        self.assertEqual(by_status.data["count"], 0)

    def test_invalid_filter_value_is_rejected(self):
        self.client.force_login(self.teacher)
        for name in ("review_status", "event_type", "severity"):
            response = self.client.get(self.list_url(), {name: "nonsense"})
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, name)
            self.assertIn(name, response.data)

    def test_other_attempts_events_are_not_listed(self):
        mine = self.make_event()
        other_attempt = create_exam_attempt(
            self.workspace, self.exam, self.student, attempt_number=2
        )
        create_proctoring_event(self.workspace, other_attempt)
        self.client.force_login(self.teacher)
        response = self.client.get(self.list_url())
        self.assertEqual([i["id"] for i in response.data["results"]], [mine.pk])

    def test_list_is_paginated(self):
        for _ in range(21):
            self.make_event()
        self.client.force_login(self.teacher)
        response = self.client.get(self.list_url())
        self.assertEqual(response.data["count"], 21)
        self.assertEqual(len(response.data["results"]), 20)
        self.assertIsNotNone(response.data["next"])

    def test_attempt_of_another_workspace_is_404_for_teacher(self):
        create_proctoring_event(self.other_workspace, self.other_attempt)
        self.client.force_login(self.teacher)
        # Guessing the id through our own slug and through theirs.
        self.assertEqual(
            self.client.get(self.list_url(self.other_attempt)).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(self.list_url(self.other_attempt, slug="beta")).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_unknown_attempt_is_404(self):
        self.client.force_login(self.teacher)
        url = f"/api/v1/workspaces/alpha/attempts/999999/proctoring/events/"
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)


class EventDetailTests(TeacherProctoringTestBase):
    def test_detail_includes_evidence_with_api_file_url(self):
        event = self.make_event()
        evidence = self.make_evidence(event)
        self.client.force_login(self.teacher)
        response = self.client.get(self.detail_url(event))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], event.pk)
        self.assertEqual(response.data["student"], self.student.pk)
        self.assertEqual(
            response.data["evidence"][0]["file_url"], self.file_url(evidence)
        )
        self.assertNotIn("storage_key", json.dumps(response.data, default=str))

    def test_event_of_another_workspace_is_404(self):
        foreign = create_proctoring_event(self.other_workspace, self.other_attempt)
        self.client.force_login(self.teacher)
        self.assertEqual(
            self.client.get(self.detail_url(foreign)).status_code,
            status.HTTP_404_NOT_FOUND,
        )


class EventReviewTests(TeacherProctoringTestBase):
    def test_teacher_dismisses_and_server_sets_reviewer_and_time(self):
        event = self.make_event()
        self.client.force_login(self.teacher)
        response = self.client.post(
            self.review_url(event), {"review_status": "dismissed"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["review_status"], "dismissed")
        event.refresh_from_db()
        self.assertEqual(event.reviewed_by_id, self.teacher.pk)
        self.assertIsNotNone(event.reviewed_at)

    def test_teacher_can_mark_violation(self):
        event = self.make_event()
        self.client.force_login(self.teacher)
        response = self.client.post(
            self.review_url(event), {"review_status": "violation"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event.refresh_from_db()
        self.assertEqual(event.review_status, ProctoringEvent.ReviewStatus.VIOLATION)

    def test_invalid_decisions_are_rejected(self):
        event = self.make_event()
        self.client.force_login(self.teacher)
        for value in ("pending", "nonsense", ""):
            response = self.client.post(
                self.review_url(event), {"review_status": value}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, value)
        missing = self.client.post(self.review_url(event), {}, format="json")
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        event.refresh_from_db()
        self.assertEqual(event.review_status, ProctoringEvent.ReviewStatus.PENDING)
        self.assertIsNone(event.reviewed_by_id)

    def test_second_review_returns_409_and_keeps_first_decision(self):
        event = self.make_event()
        self.client.force_login(self.teacher)
        self.client.post(
            self.review_url(event), {"review_status": "dismissed"}, format="json"
        )
        again = self.client.post(
            self.review_url(event), {"review_status": "violation"}, format="json"
        )
        self.assertEqual(again.status_code, status.HTTP_409_CONFLICT)
        event.refresh_from_db()
        self.assertEqual(event.review_status, ProctoringEvent.ReviewStatus.DISMISSED)

    def test_client_cannot_set_privileged_fields(self):
        event = self.make_event(severity="warning")
        self.client.force_login(self.teacher)
        self.client.post(
            self.review_url(event),
            {
                "review_status": "dismissed",
                "severity": "info",
                "reviewed_by": self.other_teacher.pk,
                "workspace": self.other_workspace.pk,
                "event_type": "tab_switch",
            },
            format="json",
        )
        event.refresh_from_db()
        self.assertEqual(event.severity, "warning")
        self.assertEqual(event.reviewed_by_id, self.teacher.pk)
        self.assertEqual(event.workspace_id, self.workspace.pk)
        self.assertEqual(event.event_type, "face_missing")

    def test_review_does_not_change_attempt_review_status(self):
        event = self.make_event()
        self.client.force_login(self.teacher)
        self.client.post(
            self.review_url(event), {"review_status": "violation"}, format="json"
        )
        self.attempt.refresh_from_db()
        self.assertEqual(
            self.attempt.proctoring_review_status,
            ExamAttempt.ReviewStatus.CLEAN,
        )

    def test_event_of_another_workspace_cannot_be_reviewed(self):
        foreign = create_proctoring_event(self.other_workspace, self.other_attempt)
        self.client.force_login(self.teacher)
        response = self.client.post(
            self.review_url(foreign), {"review_status": "dismissed"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        foreign.refresh_from_db()
        self.assertEqual(foreign.review_status, ProctoringEvent.ReviewStatus.PENDING)


class EvidenceFileTests(TeacherProctoringTestBase):
    def test_teacher_gets_snapshot_with_private_headers(self):
        event = self.make_event()
        evidence = self.make_evidence(event, mime_type="image/jpeg")
        self.client.force_login(self.teacher)
        response = self.client.get(self.file_url(evidence))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "image/jpeg")
        self.assertEqual(response["Content-Disposition"], "inline")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(b"".join(response.streaming_content), JPEG_BYTES)

    def test_png_is_served_as_png(self):
        evidence = self.make_evidence(self.make_event(), mime_type="image/png")
        self.client.force_login(self.teacher)
        response = self.client.get(self.file_url(evidence))
        self.assertEqual(response["Content-Type"], "image/png")

    def test_unexpected_mime_type_is_downloaded_not_shown(self):
        evidence = self.make_evidence(self.make_event(), mime_type="text/html")
        self.client.force_login(self.teacher)
        response = self.client.get(self.file_url(evidence))
        self.assertEqual(response["Content-Type"], "application/octet-stream")
        self.assertEqual(response["Content-Disposition"], "attachment")

    def test_missing_file_on_disk_is_404(self):
        evidence = self.make_evidence(self.make_event())
        default_storage.delete(evidence.storage_key)
        self.client.force_login(self.teacher)
        self.assertEqual(
            self.client.get(self.file_url(evidence)).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_evidence_of_another_workspace_is_404(self):
        foreign_event = create_proctoring_event(
            self.other_workspace, self.other_attempt
        )
        key = default_storage.save("proctoring/other/x.jpg", ContentFile(JPEG_BYTES))
        foreign = create_proctoring_evidence(
            self.other_workspace, foreign_event, storage_key=key
        )
        self.client.force_login(self.teacher)
        self.assertEqual(
            self.client.get(self.file_url(foreign)).status_code,
            status.HTTP_404_NOT_FOUND,
        )


class TeacherPermissionTests(TeacherProctoringTestBase):
    """Every teacher route refuses everyone who is not this workspace's teacher."""

    def setUp(self):
        super().setUp()
        self.event = self.make_event()
        self.evidence = self.make_evidence(self.event)

    def requests(self, slug="alpha"):
        return [
            ("get", self.list_url(slug=slug), None),
            ("get", self.detail_url(self.event, slug=slug), None),
            ("post", self.review_url(self.event, slug=slug), {"review_status": "dismissed"}),
            ("get", self.file_url(self.evidence, slug=slug), None),
        ]

    def assert_refused(self, user):
        if user is not None:
            self.client.force_login(user)
        for method, url, body in self.requests():
            kwargs = {"format": "json"} if method == "post" else {}
            response = getattr(self.client, method)(url, body, **kwargs) if body else getattr(self.client, method)(url)
            self.assertIn(
                response.status_code,
                (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
                f"{method} {url}",
            )
        self.event.refresh_from_db()
        self.assertEqual(self.event.review_status, ProctoringEvent.ReviewStatus.PENDING)

    def test_anonymous_is_refused(self):
        self.assert_refused(None)

    def test_student_is_refused(self):
        self.assert_refused(self.student)

    def test_pending_student_is_refused(self):
        self.assert_refused(self.pending_student)

    def test_teacher_of_another_workspace_is_refused(self):
        self.assert_refused(self.other_teacher)

    def test_suspended_workspace_is_refused(self):
        from apps.workspaces.models import Workspace

        Workspace.objects.filter(pk=self.workspace.pk).update(
            status=Workspace.Status.SUSPENDED
        )
        self.client.force_login(self.teacher)
        for method, url, body in self.requests():
            kwargs = {"format": "json"} if method == "post" else {}
            response = getattr(self.client, method)(url, body, **kwargs) if body else getattr(self.client, method)(url)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, url)
