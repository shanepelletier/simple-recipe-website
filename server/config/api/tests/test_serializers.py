import pytest

from api.serializers import recipe_card_to_dict, recipe_ingredient_to_dict


@pytest.mark.django_db
def test_card_photo_is_none_when_recipe_has_no_photo(author, make_recipe):
    card = recipe_card_to_dict(make_recipe(author))

    assert card["photo"] is None


@pytest.mark.django_db
def test_card_shows_at_most_three_tags(author, make_recipe, reference):
    recipe = make_recipe(author, tags=("quick", "vegan", "vegetarian", "spicy"))

    card = recipe_card_to_dict(recipe)

    assert len(card["tags"]) == 3


@pytest.mark.django_db
def test_ingredient_quantity_serializes_as_a_trimmed_string(author, make_recipe):
    recipe = make_recipe(author, ingredients=(("2.500", "pound", "ground beef"),))

    payload = recipe_ingredient_to_dict(recipe.ingredients.first())

    assert payload["quantity"] == "2.5"
    assert isinstance(payload["quantity"], str)
    assert payload["display"] == "2.5 pounds of ground beef"
