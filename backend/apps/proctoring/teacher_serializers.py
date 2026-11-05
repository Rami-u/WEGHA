from django.urls import reverse
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import ProctoringEvent, ProctoringEvidence
from .review_services import REVIEW_DECISIONS


class ProctoringEvidenceSerializer(serializers.ModelSerializer):
    """Evidence as the teacher sees it. storage_key is never exposed."""

    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ProctoringEvidence
        fields = ["id", "evidence_type", "mime_type", "file_url"]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField())
    def get_file_url(self, evidence):
        # The authorized API route, never the storage location.
        return reverse(
            "proctoring-evidence-file",
            kwargs={
                "slug": self.context["workspace"].slug,
                "evidence_id": evidence.pk,
            },
        )


class ProctoringEventSerializer(serializers.ModelSerializer):
    evidence = ProctoringEvidenceSerializer(many=True, read_only=True)

    class Meta:
        model = ProctoringEvent
        fields = [
            "id",
            "attempt",
            "student",
            "event_type",
            "severity",
            "occurred_at",
            "details",
            "review_status",
            "reviewed_by",
            "reviewed_at",
            "evidence",
        ]
        read_only_fields = fields


class ReviewEventSerializer(serializers.Serializer):
    """Body of the review request. Nothing else can be set by the client."""

    review_status = serializers.ChoiceField(
        choices=[(value, value) for value in REVIEW_DECISIONS],
        help_text="The teacher's decision: dismissed or violation.",
    )
