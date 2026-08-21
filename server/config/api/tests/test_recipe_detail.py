import pytest


@pytest.mark.django_db
def test_detail_returns_ingredients_and_steps_in_position_order(client, author, make_recipe):
    recipe = make_recipe(
        author,
        ingredients=(("2", "pound", "ground beef"), ("1", "whole", "onion")),
        steps=("Brown the beef", "Add the onion"),
    )

    body = client.get(f"/api/recipes/{recipe.pk}/").json()["recipe"]

    assert [i["display"] for i in body["ingredients"]] == [
        "2 pounds of ground beef",
        "1 whole onion",
    ]
    assert [s["text"] for s in body["steps"]] == ["Brown the beef", "Add the onion"]


@pytest.mark.django_db
def test_detail_includes_the_version_for_optimistic_locking(client, author, make_recipe):
    recipe = make_recipe(author)

    assert client.get(f"/api/recipes/{recipe.pk}/").json()["recipe"]["version"] == 1


@pytest.mark.django_db
def test_detail_says_the_owner_can_edit(auth_client, author, make_recipe):
    recipe = make_recipe(author)

    assert auth_client.get(f"/api/recipes/{recipe.pk}/").json()["recipe"]["can_edit"] is True


@pytest.mark.django_db
def test_detail_says_a_stranger_cannot_edit(client, author, make_recipe):
    recipe = make_recipe(author)

    assert client.get(f"/api/recipes/{recipe.pk}/").json()["recipe"]["can_edit"] is False


@pytest.mark.django_db
def test_detail_returns_404_for_a_missing_recipe(client, db):
    assert client.get("/api/recipes/999999/").status_code == 404


@pytest.mark.django_db
def test_detail_query_count_does_not_grow_with_the_number_of_ingredients(
    client, author, make_recipe, django_assert_num_queries
):
    small = make_recipe(
        author,
        ingredients=(("2", "pound", "ground beef"),),
        steps=("One",),
        tags=("quick",),
    )

    with django_assert_num_queries(6):
        client.get(f"/api/recipes/{small.pk}/")

    big = make_recipe(
        author,
        name="Big",
        ingredients=(
            ("2", "pound", "ground beef"),
            ("1", "whole", "onion"),
            ("3", "clove", "garlic"),
            ("1", "cup", "flour"),
        ),
        steps=("One", "Two", "Three", "Four"),
        tags=("quick", "vegan"),
    )

    with django_assert_num_queries(6):
        client.get(f"/api/recipes/{big.pk}/")
