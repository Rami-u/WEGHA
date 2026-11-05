from django.urls import path

from .teacher_views import (
    AttemptEventListView,
    EventDetailView,
    EventReviewView,
    EvidenceFileView,
)

urlpatterns = [
    path(
        "workspaces/<slug:slug>/attempts/<int:attempt_id>/proctoring/events/",
        AttemptEventListView.as_view(),
        name="proctoring-attempt-events",
    ),
    path(
        "workspaces/<slug:slug>/proctoring/events/<int:event_id>/",
        EventDetailView.as_view(),
        name="proctoring-event-detail",
    ),
    path(
        "workspaces/<slug:slug>/proctoring/events/<int:event_id>/review/",
        EventReviewView.as_view(),
        name="proctoring-event-review",
    ),
    path(
        "workspaces/<slug:slug>/proctoring/evidence/<int:evidence_id>/file/",
        EvidenceFileView.as_view(),
        name="proctoring-evidence-file",
    ),
]
