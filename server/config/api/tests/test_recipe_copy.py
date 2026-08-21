from pathlib import Path

import pytest
from django.test import override_settings
from recipes.models import Comment, Recipe, Review

from api.tests.test_recipe_photo import make_upload


@pytest.mark.django_db
def test_copy_duplicates_ingredients_steps_and_tags(client, author, other_user, make_recipe):
    recipe = make_recipe(
        author,
        ingredients=(("2", "pound", "ground beef"), ("1", "whole", "onion")),
        steps=("Brown", "Simmer"),
        tags=("spicy",),
    )
    client.force_login(other_user)

    body = client.post(f"/api/recipes/{recipe.pk}/copy/").json()["recipe"]

    assert [i["display"] for i in body["ingredients"]] == [
        "2 pounds of ground beef",
        "1 whole onion",
    ]
    assert [s["text"] for s in body["steps"]] == ["Brown", "Simmer"]
    assert [t["name"] for t in body["tags"]] == ["spicy"]


@pytest.mark.django_db
def test_the_copy_is_owned_by_the_copier_and_credits_the_original_author(
    client, author, other_user, make_recipe
):
    recipe = make_recipe(author)
    client.force_login(other_user)

    body = client.post(f"/api/recipes/{recipe.pk}/copy/").json()["recipe"]

    assert body["owner"] == "other"
    assert body["copied_from_username"] == "author"


@pytest.mark.django_db
def test_copy_does_not_take_reviews_or_comments(client, author, other_user, make_recipe):
    recipe = make_recipe(author)
    Review.objects.create(recipe=recipe, user=other_user, rating=5)
    Comment.objects.create(recipe=recipe, author=other_user, body="Nice")
    client.force_login(other_user)

    copy_id = client.post(f"/api/recipes/{recipe.pk}/copy/").json()["recipe"]["id"]

    copy = Recipe.objects.get(pk=copy_id)
    assert copy.reviews.count() == 0
    assert copy.comments.count() == 0
    assert copy.rating_count == 0


@pytest.mark.django_db
def test_deleting_the_original_leaves_the_copys_photo_and_attribution(
    client, author, other_user, make_recipe, tmp_path
):
    with override_settings(MEDIA_ROOT=tmp_path):
        recipe = make_recipe(author)
        recipe.photo = make_upload()
        recipe.save()
        client.force_login(other_user)
        copy_id = client.post(f"/api/recipes/{recipe.pk}/copy/").json()["recipe"]["id"]

        recipe.delete()

        copy = Recipe.objects.get(pk=copy_id)
        assert copy.copied_from is None  # SET_NULL fired
        assert copy.copied_from_username == "author"  # attribution survived
        assert Path(copy.photo.path).exists()  # the file is the copy's own


@pytest.mark.django_db
def test_copy_requires_a_signed_in_user(client, author, make_recipe):
    recipe = make_recipe(author)

    assert client.post(f"/api/recipes/{recipe.pk}/copy/").status_code == 401
