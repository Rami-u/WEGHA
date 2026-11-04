from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.tests.helpers import create_student, create_workspace
from apps.assessments.tests.helpers import create_exam, create_exam_attempt
from apps.courses.tests.helpers import create_course
from apps.payments.tests.helpers import TemporaryMediaMixin
from apps.proctoring.models import ProctoringEvent, ProctoringEvidence
from apps.proctoring.tests.helpers import (
    create_proctoring_event,
    create_proctoring_evidence,
)


class CleanProctoringEvidenceTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        self.workspace = create_workspace("alpha")
        student = create_student(
            self.workspace,
            email="student@example.com",
            approval_status=User.ApprovalStatus.APPROVED,
        )
        exam = create_exam(
            self.workspace, create_course(self.workspace), proctoring_enabled=True
        )
        self.attempt = create_exam_attempt(self.workspace, exam, student)
        self.event = create_proctoring_event(self.workspace, self.attempt)

    def make_evidence(self, expires_at, *, write_file=True):
        key = f"proctoring/{self.workspace.pk}/{self.attempt.pk}/{timezone.now().timestamp()}.jpg"
        if write_file:
            key = default_storage.save(key, ContentFile(b"jpeg"))
        return create_proctoring_evidence(
            self.workspace, self.event, storage_key=key, retention_expires_at=expires_at
        )

    def run_command(self, *args):
        out = StringIO()
        call_command("clean_proctoring_evidence", *args, stdout=out)
        return out.getvalue()

    def past(self):
        return timezone.now() - timedelta(days=1)

    def future(self):
        return timezone.now() + timedelta(days=1)

    def test_expired_evidence_file_and_row_are_removed_but_event_stays(self):
        expired = self.make_evidence(self.past())
        key = expired.storage_key
        self.run_command()
        self.assertFalse(ProctoringEvidence.objects.filter(pk=expired.pk).exists())
        self.assertFalse(default_storage.exists(key))
        self.assertTrue(ProctoringEvent.objects.filter(pk=self.event.pk).exists())

    def test_unexpired_evidence_is_untouched(self):
        kept = self.make_evidence(self.future())
        self.run_command()
        self.assertTrue(ProctoringEvidence.objects.filter(pk=kept.pk).exists())
        self.assertTrue(default_storage.exists(kept.storage_key))

    def test_evidence_without_a_retention_time_is_untouched(self):
        kept = self.make_evidence(None)
        self.run_command()
        self.assertTrue(ProctoringEvidence.objects.filter(pk=kept.pk).exists())
        self.assertTrue(default_storage.exists(kept.storage_key))

    def test_dry_run_deletes_nothing_and_reports_the_count(self):
        expired = self.make_evidence(self.past())
        output = self.run_command("--dry-run")
        self.assertIn("1 expired", output)
        self.assertTrue(ProctoringEvidence.objects.filter(pk=expired.pk).exists())
        self.assertTrue(default_storage.exists(expired.storage_key))

    def test_missing_file_is_tolerated_and_counted(self):
        expired = self.make_evidence(self.past(), write_file=False)
        output = self.run_command()
        self.assertFalse(ProctoringEvidence.objects.filter(pk=expired.pk).exists())
        self.assertIn("1 file(s) were already missing", output)

    def test_file_that_cannot_be_deleted_keeps_its_row_for_the_next_run(self):
        stuck = self.make_evidence(self.past())
        fine = self.make_evidence(self.past())
        real_delete = default_storage.delete

        def delete(name):
            if name == stuck.storage_key:
                raise PermissionError("locked")
            return real_delete(name)

        with patch.object(default_storage, "delete", side_effect=delete):
            output = self.run_command()
        self.assertTrue(ProctoringEvidence.objects.filter(pk=stuck.pk).exists())
        self.assertFalse(ProctoringEvidence.objects.filter(pk=fine.pk).exists())
        self.assertIn("1 failed", output)
