import json
from decimal import Decimal

import pytest
from recipes.models import ShoppingItem


def add(client, ingredient, unit, quantity):
    return client.post(
        "/api/shopping-list/",
        data=json.dumps({"ingredient_id": ingredient.id, "unit_id": unit.id, "quantity": quantity}),
        content_type="application/json",
    )


@pytest.mark.django_db
def test_same_ingredient_same_unit_merges_into_one_row(auth_client, reference):
    beef, pound = reference.ingredients["ground beef"], reference.units["pound"]

    add(auth_client, beef, pound, "2")
    add(auth_client, beef, pound, "3")

    item = ShoppingItem.objects.get()
    assert item.quantity == Decimal("5")
    assert str(item) == "5 pounds of ground beef"


@pytest.mark.django_db
def test_same_ingredient_different_unit_stays_two_rows(auth_client, reference):
    beef = reference.ingredients["ground beef"]

    add(auth_client, beef, reference.units["pound"], "1")
    add(auth_client, beef, reference.units["cup"], "1")

    assert ShoppingItem.objects.count() == 2


@pytest.mark.django_db
def test_two_units_of_one_ingredient_share_a_group_heading(auth_client, reference):
    beef = reference.ingredients["ground beef"]
    add(auth_client, beef, reference.units["pound"], "1")
    add(auth_client, beef, reference.units["cup"], "1")

    groups = auth_client.get("/api/shopping-list/").json()["groups"]

    assert len(groups) == 1
    assert groups[0]["ingredient"] == "ground beef"
    assert [i["display"] for i in groups[0]["items"]] == [
        "1 cup of ground beef",
        "1 pound of ground beef",
    ]


@pytest.mark.django_db
def test_a_third_of_a_cup_twice_does_not_lose_precision(auth_client, reference):
    flour, cup = reference.ingredients["flour"], reference.units["cup"]

    add(auth_client, flour, cup, "0.333")
    add(auth_client, flour, cup, "0.334")

    assert ShoppingItem.objects.get().quantity == Decimal("0.667")


@pytest.mark.django_db
@pytest.mark.parametrize("quantity", ["0", "-1", "abc", None])
def test_a_non_positive_quantity_is_rejected(auth_client, reference, quantity):
    response = add(auth_client, reference.ingredients["flour"], reference.units["cup"], quantity)

    assert response.status_code == 400
    assert ShoppingItem.objects.count() == 0


@pytest.mark.django_db
def test_the_list_only_ever_shows_your_own_items(client, author, other_user, reference):
    ShoppingItem.objects.create(
        user=other_user,
        ingredient=reference.ingredients["flour"],
        unit=reference.units["cup"],
        quantity=Decimal("1"),
    )
    client.force_login(author)

    assert client.get("/api/shopping-list/").json()["groups"] == []


@pytest.mark.django_db
def test_the_shopping_list_requires_a_signed_in_user(client, db):
    assert client.get("/api/shopping-list/").status_code == 401


@pytest.mark.django_db
def test_adding_a_recipe_adds_all_its_ingredients(auth_client, author, make_recipe):
    make_recipe(author, ingredients=(("2", "pound", "ground beef"), ("1", "whole", "onion")))
    recipe_id = author.recipes.get().id

    groups = auth_client.post(f"/api/shopping-list/from-recipe/{recipe_id}/").json()["groups"]

    assert [g["ingredient"] for g in groups] == ["ground beef", "onion"]


@pytest.mark.django_db
def test_adding_the_same_recipe_twice_doubles_the_quantities(auth_client, author, make_recipe):
    recipe = make_recipe(author, ingredients=(("2", "pound", "ground beef"),))

    auth_client.post(f"/api/shopping-list/from-recipe/{recipe.pk}/")
    auth_client.post(f"/api/shopping-list/from-recipe/{recipe.pk}/")

    assert ShoppingItem.objects.get().quantity == Decimal("4")


@pytest.mark.django_db
def test_two_recipes_sharing_an_ingredient_and_unit_merge(auth_client, author, make_recipe):
    chili = make_recipe(author, name="Chili", ingredients=(("2", "pound", "ground beef"),))
    tacos = make_recipe(author, name="Tacos", ingredients=(("1", "pound", "ground beef"),))

    auth_client.post(f"/api/shopping-list/from-recipe/{chili.pk}/")
    auth_client.post(f"/api/shopping-list/from-recipe/{tacos.pk}/")

    assert ShoppingItem.objects.get().quantity == Decimal("3")


@pytest.mark.django_db
def test_two_recipes_sharing_an_ingredient_in_different_units_do_not_merge(
    auth_client, author, make_recipe
):
    chili = make_recipe(author, name="Chili", ingredients=(("2", "pound", "ground beef"),))
    bowl = make_recipe(author, name="Bowl", ingredients=(("1", "cup", "ground beef"),))

    auth_client.post(f"/api/shopping-list/from-recipe/{chili.pk}/")
    auth_client.post(f"/api/shopping-list/from-recipe/{bowl.pk}/")

    assert ShoppingItem.objects.count() == 2
