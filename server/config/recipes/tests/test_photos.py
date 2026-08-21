from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from recipes.photos import delete_photo_file, upload_to, validate_image


def test_upload_to_discards_original_filename():
    instance = SimpleNamespace(_meta=SimpleNamespace(model_name="recipe"))
    path = upload_to(instance, "my vacation photo.JPG")
    assert path.startswith("recipes/")
    assert path.endswith(".jpg")
    assert "vacation" not in path


def test_upload_to_folder_matches_model_name():
    instance = SimpleNamespace(_meta=SimpleNamespace(model_name="comment"))
    path = upload_to(instance, "photo.png")
    assert path.startswith("comments/")


def test_upload_to_produces_unique_names():
    instance = SimpleNamespace(_meta=SimpleNamespace(model_name="recipe"))
    assert upload_to(instance, "photo.jpg") != upload_to(instance, "photo.jpg")


def test_validate_image_accepts_allowed_extension_under_size_limit():
    buffer = BytesIO()
    Image.new("RGB", (10, 10)).save(buffer, format="JPEG")
    file = SimpleUploadedFile("photo.jpg", buffer.getvalue(), content_type="image/jpeg")

    validate_image(file)  # does not raise


def test_validate_image_rejects_a_file_pillow_cannot_open():
    file = SimpleUploadedFile("photo.jpg", b"not actually an image", content_type="image/jpeg")

    with pytest.raises(ValidationError):
        validate_image(file)


def test_validate_image_rejects_oversized_file():
    file = SimpleNamespace(size=settings.MAX_UPLOAD_BYTES + 1, name="photo.jpg")
    with pytest.raises(ValidationError):
        validate_image(file)


def test_validate_image_rejects_disallowed_extension():
    file = SimpleNamespace(size=1024, name="photo.exe")
    with pytest.raises(ValidationError):
        validate_image(file)


def test_delete_photo_file_deletes_when_photo_present():
    photo = MagicMock()
    instance = SimpleNamespace(photo=photo)
    delete_photo_file(sender=None, instance=instance)
    photo.delete.assert_called_once_with(save=False)


def test_delete_photo_file_noop_when_no_photo():
    instance = SimpleNamespace(photo=None)
    delete_photo_file(sender=None, instance=instance)  # does not raise
