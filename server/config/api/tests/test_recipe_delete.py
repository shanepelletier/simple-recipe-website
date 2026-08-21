from decimal import Decimal
from pathlib import Path

import pytest
from django.core.files.base import ContentFile
from django.test import override_settings
from recipes.models import Recipe, ShoppingItem


@pytest.mark.django_db
def test_owner_can_delete_their_recipe(auth_client, author, make_recipe):
    recipe = make_recipe(author)

    response = auth_client.delete(f"/api/recipes/{recipe.pk}/")

    assert response.status_code == 200
    assert not Recipe.objects.filter(pk=recipe.pk).exists()


@pytest.mark.django_db
def test_a_stranger_cannot_delete_someone_elses_recipe(client, author, other_user, make_recipe):
    recipe = make_recipe(author)
    client.force_login(other_user)

    assert client.delete(f"/api/recipes/{recipe.pk}/").status_code == 403
    assert Recipe.objects.filter(pk=recipe.pk).exists()


@pytest.mark.django_db
def test_a_moderator_can_delete_anyones_recipe(client, author, moderator, make_recipe):
    recipe = make_recipe(author)
    client.force_login(moderator)

    assert client.delete(f"/api/recipes/{recipe.pk}/").status_code == 200


@pytest.mark.django_db
def test_anonymous_users_get_401(client, author, make_recipe):
    recipe = make_recipe(author)

    assert client.delete(f"/api/recipes/{recipe.pk}/").status_code == 401


@pytest.mark.django_db
def test_deleting_a_recipe_removes_its_photo_file(auth_client, author, make_recipe, tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        recipe = make_recipe(author)
        recipe.photo = ContentFile(b"fake-image-bytes", name="test.jpg")
        recipe.save()
        photo_path = recipe.photo.path

        auth_client.delete(f"/api/recipes/{recipe.pk}/")

        assert not Path(photo_path).exists()


@pytest.mark.django_db
def test_deleting_a_recipe_leaves_shopping_items_behind(
    auth_client, author, make_recipe, reference
):
    recipe = make_recipe(author)
    item = ShoppingItem.objects.create(
        user=author,
        ingredient=reference.ingredients["ground beef"],
        unit=reference.units["pound"],
        quantity=Decimal("2"),
        source_recipe=recipe,
    )

    auth_client.delete(f"/api/recipes/{recipe.pk}/")

    item.refresh_from_db()
    assert item.source_recipe is None  # you still need to buy the beef
