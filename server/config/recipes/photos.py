from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def upload_to(instance, filename: str) -> str:
    """Never let a user-supplied filename reach the filesystem.

    Also prevents two people uploading "photo.jpg" from colliding.
    """
    extension = Path(filename).suffix.lower()
    folder = f"{instance._meta.model_name}s"      # "recipes" / "comments"
    return f"{folder}/{uuid4().hex}{extension}"


def validate_image(file):
    if file.size > settings.MAX_UPLOAD_BYTES:
        limit_mb = settings.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise ValidationError(f"Image must be smaller than {limit_mb} MB.")
    if Path(file.name).suffix.lower() not in ALLOWED_EXTENSIONS:
        raise ValidationError("Image must be a JPG, PNG, or WebP file.")


def delete_photo_file(sender, instance, **kwargs):
    """Django has not deleted files on model delete since 1.3."""
    if instance.photo:
        instance.photo.delete(save=False)
