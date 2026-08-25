import json

import pytest
from recipes.models import Recipe


def post(client, body):
    return client.post("/api/recipes/", data=json.dumps(body), content_type="application/json")


def valid_body(reference):
    return {
        "name": "Chili",
        "tags": [reference.tags["spicy"].id],
        "ingredients": [
            {
                "ingredient_id": reference.ingredients["ground beef"].id,
                "unit_id": reference.units["pound"].id,
                "quantity": "2",
            },
            {
                "ingredient_id": reference.ingredients["onion"].id,
                "unit_id": reference.units["whole"].id,
                "quantity": "1",
            },
        ],
        "steps": ["Brown the beef", "Simmer"],
    }


@pytest.mark.django_db
def test_create_returns_201_with_the_new_recipe(auth_client, reference):
    response = post(auth_client, valid_body(reference))

    assert response.status_code == 201
    body = response.json()["recipe"]
    assert body["name"] == "Chili"
    assert [i["display"] for i in body["ingredients"]] == [
        "2 pounds of ground beef",
        "1 whole onion",
    ]
    assert [s["text"] for s in body["steps"]] == ["Brown the beef", "Simmer"]


@pytest.mark.django_db
def test_create_requires_a_signed_in_user(client, reference):
    assert post(client, valid_body(reference)).status_code == 401


@pytest.mark.django_db
def test_create_sets_the_owner_to_the_signed_in_user(auth_client, author, reference):
    post(auth_client, valid_body(reference))

    assert Recipe.objects.get().owner == author


@pytest.mark.django_db
def test_create_rejects_more_than_the_tag_cap(auth_client, reference, settings):
    body = valid_body(reference)
    body["tags"] = [t.id for t in reference.tags.values()][: settings.MAX_TAGS_PER_RECIPE + 1]

    response = post(auth_client, body)

    assert response.status_code == 400
    assert "tags" in response.json()["fields"]


@pytest.mark.django_db
def test_a_rejected_create_writes_nothing(auth_client, reference):
    body = valid_body(reference)
    body["ingredients"] = []

    post(auth_client, body)

    assert Recipe.objects.count() == 0


@pytest.mark.django_db
def test_a_json_body_that_is_not_an_object_is_rejected_rather_than_crashing(auth_client):
    # A JSON list parses fine but every view does body.get(...) next.
    response = auth_client.post("/api/recipes/", data="[1, 2, 3]", content_type="application/json")

    assert response.status_code == 400
