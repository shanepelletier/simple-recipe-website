import json

import pytest


def patch(client, pk, body):
    return client.patch(
        f"/api/recipes/{pk}/", data=json.dumps(body), content_type="application/json"
    )


def edit_body(reference, version, name="Renamed"):
    return {
        "version": version,
        "name": name,
        "tags": [],
        "ingredients": [
            {
                "ingredient_id": reference.ingredients["onion"].id,
                "unit_id": reference.units["whole"].id,
                "quantity": "3",
            }
        ],
        "steps": ["Chop"],
    }


@pytest.mark.django_db
def test_a_second_save_with_a_stale_version_gets_409(auth_client, author, make_recipe, reference):
    recipe = make_recipe(author)

    first = patch(auth_client, recipe.pk, edit_body(reference, version=1, name="First"))
    second = patch(auth_client, recipe.pk, edit_body(reference, version=1, name="Second"))

    assert first.status_code == 200
    assert second.status_code == 409
    recipe.refresh_from_db()
    assert recipe.name == "First"  # the stale write did NOT land


@pytest.mark.django_db
def test_a_successful_save_bumps_the_version(auth_client, author, make_recipe, reference):
    recipe = make_recipe(author)

    body = patch(auth_client, recipe.pk, edit_body(reference, version=1)).json()["recipe"]

    assert body["version"] == 2


@pytest.mark.django_db
def test_saving_again_with_the_new_version_succeeds(auth_client, author, make_recipe, reference):
    recipe = make_recipe(author)

    patch(auth_client, recipe.pk, edit_body(reference, version=1))
    second = patch(auth_client, recipe.pk, edit_body(reference, version=2, name="Second"))

    assert second.status_code == 200


@pytest.mark.django_db
def test_update_replaces_ingredients_rather_than_appending(
    auth_client, author, make_recipe, reference
):
    recipe = make_recipe(
        author, ingredients=(("2", "pound", "ground beef"), ("1", "whole", "tomato"))
    )

    body = patch(auth_client, recipe.pk, edit_body(reference, version=1)).json()["recipe"]

    assert [i["display"] for i in body["ingredients"]] == ["3 whole onions"]


@pytest.mark.django_db
def test_update_refreshes_updated_at(auth_client, author, make_recipe, reference):
    recipe = make_recipe(author)
    before = recipe.updated_at

    patch(auth_client, recipe.pk, edit_body(reference, version=1))

    recipe.refresh_from_db()
    assert recipe.updated_at > before


@pytest.mark.django_db
def test_a_stranger_cannot_edit_someone_elses_recipe(
    client, author, other_user, make_recipe, reference
):
    recipe = make_recipe(author)
    client.force_login(other_user)

    assert patch(client, recipe.pk, edit_body(reference, version=1)).status_code == 403


@pytest.mark.django_db
def test_a_non_numeric_version_is_rejected_rather_than_crashing(
    auth_client, author, make_recipe, reference
):
    recipe = make_recipe(author)

    response = patch(auth_client, recipe.pk, edit_body(reference, version="not-a-version"))

    assert response.status_code == 400
    assert "version" in response.json()["fields"]


@pytest.mark.django_db
def test_a_moderator_can_edit_anyones_recipe(client, author, moderator, make_recipe, reference):
    recipe = make_recipe(author)
    client.force_login(moderator)

    assert patch(client, recipe.pk, edit_body(reference, version=1)).status_code == 200


@pytest.mark.django_db
def test_anonymous_users_get_401(client, author, make_recipe, reference):
    recipe = make_recipe(author)

    assert patch(client, recipe.pk, edit_body(reference, version=1)).status_code == 401
