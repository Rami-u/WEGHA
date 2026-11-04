import logging

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.proctoring.models import ProctoringEvidence

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Delete proctoring evidence files and rows whose retention time has "
        "passed. The proctoring events themselves are kept."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only print how many evidence rows are expired; delete nothing.",
        )

    def handle(self, *args, **options):
        expired = ProctoringEvidence.objects.filter(
            retention_expires_at__isnull=False,
            retention_expires_at__lt=timezone.now(),
        )

        if options["dry_run"]:
            self.stdout.write(f"Dry run: {expired.count()} expired evidence row(s).")
            return

        deleted = missing = failed = 0
        for evidence in expired.iterator():
            try:
                if default_storage.exists(evidence.storage_key):
                    default_storage.delete(evidence.storage_key)
                else:
                    missing += 1
            except OSError:
                # Keep the row so the next run retries this file.
                logger.exception(
                    "Could not delete file of proctoring evidence %s", evidence.pk
                )
                failed += 1
                continue
            evidence.delete()
            deleted += 1

        self.stdout.write(
            f"Deleted {deleted} evidence row(s) "
            f"({missing} file(s) were already missing, {failed} failed)."
        )
