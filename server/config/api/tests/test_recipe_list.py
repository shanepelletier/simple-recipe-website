import pytest
from recipes.models import Recipe


@pytest.mark.django_db
def test_list_returns_recipes_with_paging_metadata(client, author, make_recipe):
    make_recipe(author, name="Chili")

    body = client.get("/api/recipes/").json()

    assert body["total"] == 1
    assert body["page"] == 1
    assert body["results"][0]["name"] == "Chili"


@pytest.mark.django_db
def test_search_matches_case_insensitively_on_part_of_the_name(client, author, make_recipe):
    make_recipe(author, name="Classic Beef Chili")
    make_recipe(author, name="Pancakes")

    body = client.get("/api/recipes/?search=chil").json()

    assert [r["name"] for r in body["results"]] == ["Classic Beef Chili"]


@pytest.mark.django_db
def test_tag_filter_returns_only_recipes_carrying_that_tag(client, author, make_recipe):
    make_recipe(author, name="Soup", tags=("vegan",))
    make_recipe(author, name="Steak", tags=("quick",))

    body = client.get("/api/recipes/?tag=vegan").json()

    assert [r["name"] for r in body["results"]] == ["Soup"]


@pytest.mark.django_db
def test_multiple_tags_require_a_recipe_to_carry_all_of_them(client, author, make_recipe):
    make_recipe(author, name="Vegan Quick Soup", tags=("vegan", "quick"))
    make_recipe(author, name="Vegan Slow Stew", tags=("vegan",))
    make_recipe(author, name="Quick Beef Steak", tags=("quick",))

    body = client.get("/api/recipes/?tag=vegan&tag=quick").json()

    assert [r["name"] for r in body["results"]] == ["Vegan Quick Soup"]


@pytest.mark.django_db
def test_author_filter_returns_only_that_users_recipes(client, author, other_user, make_recipe):
    make_recipe(author, name="Mine")
    make_recipe(other_user, name="Theirs")

    body = client.get("/api/recipes/?author=other").json()

    assert [r["name"] for r in body["results"]] == ["Theirs"]


@pytest.mark.django_db
def test_min_rating_excludes_lower_rated_recipes(client, author, make_recipe):
    good = make_recipe(author, name="Good")
    Recipe.objects.filter(pk=good.pk).update(rating_sum=10, rating_count=2)  # 5.0
    poor = make_recipe(author, name="Poor")
    Recipe.objects.filter(pk=poor.pk).update(rating_sum=4, rating_count=2)  # 2.0

    body = client.get("/api/recipes/?min_rating=4").json()

    assert [r["name"] for r in body["results"]] == ["Good"]


@pytest.mark.django_db
def test_unrated_recipes_sort_last_by_rating(client, author, make_recipe):
    unrated = make_recipe(author, name="Unrated")
    rated = make_recipe(author, name="Rated")
    Recipe.objects.filter(pk=rated.pk).update(rating_sum=5, rating_count=1)

    body = client.get("/api/recipes/?sort=rating").json()

    assert [r["name"] for r in body["results"]] == ["Rated", "Unrated"]
    assert unrated.rating_count == 0


@pytest.mark.django_db
def test_an_unknown_sort_key_falls_back_instead_of_erroring(client, author, make_recipe):
    make_recipe(author, name="Only")

    response = client.get("/api/recipes/?sort=DROP TABLE recipes")

    assert response.status_code == 200
    assert response.json()["results"][0]["name"] == "Only"


@pytest.mark.django_db
def test_paging_splits_results_and_reports_the_page_count(client, author, make_recipe, settings):
    for index in range(30):
        make_recipe(author, name=f"Recipe {index}")

    body = client.get("/api/recipes/?page=2").json()

    assert body["total"] == 30
    assert body["pages"] == 2
    assert len(body["results"]) == 6


@pytest.mark.django_db
def test_query_count_does_not_grow_with_the_number_of_recipes(
    client, author, make_recipe, django_assert_num_queries
):
    for index in range(3):
        make_recipe(author, name=f"Small {index}", tags=("quick",))

    with django_assert_num_queries(3):
        client.get("/api/recipes/")

    for index in range(20):
        make_recipe(author, name=f"Big {index}", tags=("quick",))

    with django_assert_num_queries(3):
        client.get("/api/recipes/")
