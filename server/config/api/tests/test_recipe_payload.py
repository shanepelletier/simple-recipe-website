from decimal import Decimal

import pytest
from recipes.models import Ingredient

from api.recipe_payload import RecipeInvalid, parse_recipe_payload


def payload(reference, **overrides):
    body = {
        "name": "Chili",
        "tags": [],
        "ingredients": [
            {
                "ingredient_id": reference.ingredients["ground beef"].id,
                "unit_id": reference.units["pound"].id,
                "quantity": "2",
            }
        ],
        "steps": ["Brown the beef"],
    }
    body.update(overrides)
    return body


@pytest.mark.django_db
def test_a_valid_payload_parses(reference):
    parsed = parse_recipe_payload(payload(reference))

    assert parsed.name == "Chili"
    assert parsed.ingredients[0]["quantity"] == Decimal("2")
    assert parsed.steps == ["Brown the beef"]


@pytest.mark.django_db
def test_a_missing_name_is_rejected(reference):
    with pytest.raises(RecipeInvalid) as caught:
        parse_recipe_payload(payload(reference, name="   "))

    assert "name" in caught.value.fields


@pytest.mark.django_db
def test_an_empty_ingredient_list_is_rejected(reference):
    with pytest.raises(RecipeInvalid) as caught:
        parse_recipe_payload(payload(reference, ingredients=[]))

    assert "ingredients" in caught.value.fields


@pytest.mark.django_db
def test_an_empty_step_list_is_rejected(reference):
    with pytest.raises(RecipeInvalid) as caught:
        parse_recipe_payload(payload(reference, steps=["  "]))

    assert "steps" in caught.value.fields


@pytest.mark.django_db
def test_too_many_tags_is_rejected(reference, settings):
    tag_ids = [tag.id for tag in reference.tags.values()][: settings.MAX_TAGS_PER_RECIPE + 1]

    with pytest.raises(RecipeInvalid) as caught:
        parse_recipe_payload(payload(reference, tags=tag_ids))

    assert "tags" in caught.value.fields


@pytest.mark.django_db
def test_a_zero_quantity_is_rejected(reference):
    bad = payload(reference)
    bad["ingredients"][0]["quantity"] = "0"

    with pytest.raises(RecipeInvalid) as caught:
        parse_recipe_payload(bad)

    assert "ingredients" in caught.value.fields


@pytest.mark.django_db
def test_a_non_numeric_quantity_is_rejected(reference):
    bad = payload(reference)
    bad["ingredients"][0]["quantity"] = "two"

    with pytest.raises(RecipeInvalid) as caught:
        parse_recipe_payload(bad)

    assert "ingredients" in caught.value.fields


@pytest.mark.django_db
def test_every_bad_ingredient_row_is_reported_at_once(reference):
    bad = payload(reference)
    bad["ingredients"] = [
        {"unit_id": reference.units["pound"].id, "quantity": "0"},
        {"unit_id": reference.units["pound"].id, "quantity": "nope"},
    ]

    with pytest.raises(RecipeInvalid) as caught:
        parse_recipe_payload(bad)

    assert len(caught.value.fields["ingredients"]) == 2


@pytest.mark.django_db
def test_a_new_ingredient_name_creates_the_ingredient(reference):
    body = payload(reference)
    body["ingredients"][0] = {
        "ingredient_name": "  Okra ",
        "unit_id": reference.units["pound"].id,
        "quantity": "1",
    }

    parsed = parse_recipe_payload(body)

    assert parsed.ingredients[0]["ingredient"].normalized_name == "okra"
    assert Ingredient.objects.filter(normalized_name="okra").count() == 1


@pytest.mark.django_db
def test_a_new_ingredient_name_reuses_an_existing_row_case_insensitively(reference):
    body = payload(reference)
    body["ingredients"][0] = {
        "ingredient_name": "TOMATO",
        "unit_id": reference.units["whole"].id,
        "quantity": "1",
    }

    parsed = parse_recipe_payload(body)

    assert parsed.ingredients[0]["ingredient"] == reference.ingredients["tomato"]
