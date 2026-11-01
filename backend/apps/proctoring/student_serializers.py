import io

from django.conf import settings
from django.utils import timezone
from PIL import Image
from rest_framework import serializers

from .vision_adapter import BROWSER_EVENT_TYPES

CONTENT_TYPE_BY_FORMAT = {"JPEG": "image/jpeg", "PNG": "image/png"}
MAX_FUTURE_SECONDS = 60


class FrameUploadSerializer(serializers.Serializer):
    image = serializers.FileField(
        help_text="One webcam frame as a JPEG or PNG image.",
    )

    def validate(self, attrs):
        upload = attrs["image"]
        if upload.size > settings.PROCTORING_FRAME_MAX_BYTES:
            raise serializers.ValidationError({"image": "The image is too large."})
        data = upload.read()
        try:
            with Image.open(io.BytesIO(data)) as picture:
                image_format = picture.format
                width, height = picture.size
                picture.verify()
        except Exception as exc:
            raise serializers.ValidationError(
                {"image": "The file is not a valid image."}
            ) from exc
        if image_format not in CONTENT_TYPE_BY_FORMAT:
            raise serializers.ValidationError(
                {"image": "Only JPEG and PNG images are accepted."}
            )
        if width * height > settings.PROCTORING_FRAME_MAX_PIXELS:
            raise serializers.ValidationError(
                {"image": "The image has too many pixels."}
            )
        attrs["image_bytes"] = data
        attrs["content_type"] = CONTENT_TYPE_BY_FORMAT[image_format]
        return attrs


class BrowserEventSerializer(serializers.Serializer):
    """A browser signal for an in-progress attempt.

    Needs context["attempt"] to check the time limits.
    """

    type = serializers.ChoiceField(choices=tuple(BROWSER_EVENT_TYPES))
    started_at = serializers.DateTimeField(required=False)
    duration_seconds = serializers.FloatField(
        required=False, min_value=0, max_value=86400
    )

    def validate_started_at(self, value):
        now = timezone.now()
        if (value - now).total_seconds() > MAX_FUTURE_SECONDS:
            raise serializers.ValidationError("started_at is in the future.")
        if value < self.context["attempt"].started_at:
            raise serializers.ValidationError(
                "started_at is before the attempt started."
            )
        return value


class OkResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()