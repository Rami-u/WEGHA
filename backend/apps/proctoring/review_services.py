from django.db import transaction
from django.utils import timezone

from .models import ProctoringEvent

# The only decisions a teacher can record. "pending" is the starting state.
REVIEW_DECISIONS = (
    ProctoringEvent.ReviewStatus.DISMISSED,
    ProctoringEvent.ReviewStatus.VIOLATION,
)


class ReviewConflictError(Exception):
    """Raised when an event has already been reviewed; carries a message."""


@transaction.atomic
def review_event(event_id, workspace, reviewer, review_status):
    """Record the teacher's decision on one proctoring event.

    Returns the event, or None if it does not exist in this workspace.
    Raises ReviewConflictError if the event is no longer pending, and
    ValueError if review_status is not a teacher decision.

    The row is locked so two simultaneous reviews are handled one after the
    other and the second one gets the conflict. This never touches
    ExamAttempt.proctoring_review_status: proctoring gives signals, and the
    teacher's decision on an event is not an automatic verdict on the attempt.
    """
    if review_status not in REVIEW_DECISIONS:
        raise ValueError("review_status must be 'dismissed' or 'violation'.")

    event = (
        ProctoringEvent.objects.select_for_update()
        .filter(workspace=workspace, pk=event_id)
        .first()
    )
    if event is None:
        return None
    if event.review_status != ProctoringEvent.ReviewStatus.PENDING:
        raise ReviewConflictError("This event has already been reviewed.")

    event.review_status = review_status
    event.reviewed_by = reviewer
    event.reviewed_at = timezone.now()
    event.full_clean()
    event.save(update_fields=["review_status", "reviewed_by", "reviewed_at"])
    return event
