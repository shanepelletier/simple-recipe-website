from io import BytesIO
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image


def make_upload(name="photo.jpg", size=(80, 60), fmt="JPEG"):
    buffer = BytesIO()
    Image.new("RGB", size, (200, 100, 50)).save(buffer, format=fmt)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


@pytest.mark.django_db
def test_uploading_a_photo_returns_its_url(auth_client, author, make_recipe, tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        recipe = make_recipe(author)

        response = auth_client.post(f"/api/recipes/{recipe.pk}/photo/", {"photo": make_upload()})

        assert response.status_code == 200
        assert response.json()["photo"].startswith("/media/recipes/")


@pytest.mark.django_db
def test_the_stored_filename_is_a_uuid_not_the_uploaded_name(
    auth_client, author, make_recipe, tmp_path
):
    with override_settings(MEDIA_ROOT=tmp_path):
        recipe = make_recipe(author)

        auth_client.post(
            f"/api/recipes/{recipe.pk}/photo/", {"photo": make_upload("../../evil.jpg")}
        )

        recipe.refresh_from_db()
        assert "evil" not in recipe.photo.name


@pytest.mark.django_db
def test_replacing_a_photo_deletes_the_old_file(auth_client, author, make_recipe, tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        recipe = make_recipe(author)
        auth_client.post(f"/api/recipes/{recipe.pk}/photo/", {"photo": make_upload()})
        recipe.refresh_from_db()
        first_path = recipe.photo.path

        auth_client.post(f"/api/recipes/{recipe.pk}/photo/", {"photo": make_upload()})

        recipe.refresh_from_db()
        assert recipe.photo.path != first_path
        assert not Path(first_path).exists()  # no orphan left behind


@pytest.mark.django_db
def test_a_non_image_file_is_rejected(auth_client, author, make_recipe, tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        recipe = make_recipe(author)
        fake = SimpleUploadedFile("virus.jpg", b"MZ\x90\x00 not an image", "image/jpeg")

        response = auth_client.post(f"/api/recipes/{recipe.pk}/photo/", {"photo": fake})

        assert response.status_code == 400


@pytest.mark.django_db
def test_a_disallowed_extension_is_rejected(auth_client, author, make_recipe, tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        recipe = make_recipe(author)

        response = auth_client.post(
            f"/api/recipes/{recipe.pk}/photo/", {"photo": make_upload("photo.gif", fmt="GIF")}
        )

        assert response.status_code == 400


@pytest.mark.django_db
def test_an_oversized_file_is_rejected(auth_client, author, make_recipe, tmp_path, settings):
    settings.MAX_UPLOAD_BYTES = 100
    with override_settings(MEDIA_ROOT=tmp_path):
        recipe = make_recipe(author)

        response = auth_client.post(
            f"/api/recipes/{recipe.pk}/photo/", {"photo": make_upload(size=(400, 400))}
        )

        assert response.status_code == 400


@pytest.mark.django_db
def test_a_stranger_cannot_upload_to_someone_elses_recipe(
    client, author, other_user, make_recipe, tmp_path
):
    with override_settings(MEDIA_ROOT=tmp_path):
        recipe = make_recipe(author)
        client.force_login(other_user)

        response = client.post(f"/api/recipes/{recipe.pk}/photo/", {"photo": make_upload()})

        assert response.status_code == 403
