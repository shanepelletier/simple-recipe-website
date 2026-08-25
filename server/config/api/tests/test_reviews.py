import json

import pytest
from django.test import Client
from recipes.models import Review


def put_rating(client, pk, rating):
    return client.put(
        f"/api/recipes/{pk}/review/",
        data=json.dumps({"rating": rating}),
        content_type="application/json",
    )


@pytest.mark.django_db
def test_rating_a_recipe_updates_the_denormalized_counters(auth_client, other_user, make_recipe):
    recipe = make_recipe(other_user)

    body = put_rating(auth_client, recipe.pk, 4).json()

    assert body["recipe"]["rating"] == 4.0
    assert body["recipe"]["rating_count"] == 1


@pytest.mark.django_db
def test_rating_twice_updates_rather_than_duplicating(auth_client, other_user, make_recipe):
    recipe = make_recipe(other_user)

    put_rating(auth_client, recipe.pk, 5)
    body = put_rating(auth_client, recipe.pk, 2).json()

    assert Review.objects.filter(recipe=recipe).count() == 1
    assert body["recipe"]["rating"] == 2.0
    assert body["recipe"]["rating_count"] == 1


@pytest.mark.django_db
def test_rating_your_own_recipe_is_forbidden(auth_client, author, make_recipe):
    recipe = make_recipe(author)

    response = put_rating(auth_client, recipe.pk, 5)

    assert response.status_code == 403
    assert Review.objects.filter(recipe=recipe).count() == 0
    recipe.refresh_from_db()
    assert recipe.rating_count == 0


@pytest.mark.django_db
def test_counters_match_the_review_rows_after_several_writes(
    client, make_user, author, make_recipe
):
    recipe = make_recipe(author)
    for index, rating in enumerate([5, 3, 4]):
        client.force_login(make_user(f"reviewer{index}"))
        put_rating(client, recipe.pk, rating)

    recipe.refresh_from_db()
    ratings = list(Review.objects.filter(recipe=recipe).values_list("rating", flat=True))
    assert recipe.rating_sum == sum(ratings)
    assert recipe.rating_count == len(ratings)


@pytest.mark.django_db
def test_deleting_a_review_subtracts_only_that_review_from_the_counters(
    auth_client, other_user, make_user, make_recipe
):
    recipe = make_recipe(make_user("owner"))
    put_rating(auth_client, recipe.pk, 5)

    # auth_client reuses the `client` fixture under the hood, so a second
    # independent Client is required here — force_login-ing `client` again
    # would just re-log-in the SAME session auth_client holds a reference
    # to, and the delete below would silently act as other_user instead.
    other_client = Client()
    other_client.force_login(other_user)
    put_rating(other_client, recipe.pk, 3)

    auth_client.delete(f"/api/recipes/{recipe.pk}/review/")

    recipe.refresh_from_db()
    assert recipe.rating_sum == 3  # only other_user's rating remains
    assert recipe.rating_count == 1
    assert recipe.rating_average == 3.0


@pytest.mark.django_db
@pytest.mark.parametrize("rating", [0, 6, -1, "five", None])
def test_an_out_of_range_rating_is_rejected(auth_client, author, make_recipe, rating):
    recipe = make_recipe(author)

    assert put_rating(auth_client, recipe.pk, rating).status_code == 400


@pytest.mark.django_db
def test_rating_requires_a_signed_in_user(client, author, make_recipe):
    recipe = make_recipe(author)

    assert put_rating(client, recipe.pk, 5).status_code == 401


@pytest.mark.django_db
def test_deleting_a_review_you_never_left_is_a_404(auth_client, author, make_recipe):
    recipe = make_recipe(author)

    assert auth_client.delete(f"/api/recipes/{recipe.pk}/review/").status_code == 404


@pytest.mark.django_db
def test_rating_a_missing_recipe_is_a_404(auth_client, db):
    assert put_rating(auth_client, 999999, 5).status_code == 404
