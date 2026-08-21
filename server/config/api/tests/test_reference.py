import pytest
from recipes.models import Ingredient


@pytest.mark.django_db
def test_tags_come_back_alphabetically(client, reference):
    names = [tag["name"] for tag in client.get("/api/tags/").json()["results"]]

    assert names == sorted(names)


@pytest.mark.django_db
def test_units_are_grouped_by_category(client, reference):
    groups = client.get("/api/units/").json()["groups"]

    assert [g["category"] for g in groups] == ["mass", "volume", "count"]
    assert "pound" in [u["name"] for g in groups for u in g["units"]]


@pytest.mark.django_db
def test_units_carry_the_fields_the_formatter_needs(client, reference):
    groups = client.get("/api/units/").json()["groups"]
    whole = next(u for g in groups for u in g["units"] if u["name"] == "whole")

    assert whole["takes_of"] is False
    assert whole["plural"] == "whole"


@pytest.mark.django_db
def test_ingredient_search_is_case_insensitive(client, reference):
    results = client.get("/api/ingredients/?q=TOM").json()["results"]

    assert "tomato" in [i["name"] for i in results]


@pytest.mark.django_db
def test_ingredient_search_is_capped(client, reference):
    Ingredient.objects.bulk_create(
        Ingredient(name=f"aaa{i}", plural=f"aaa{i}s", normalized_name=f"aaa{i}") for i in range(30)
    )

    results = client.get("/api/ingredients/?q=aaa").json()["results"]

    assert len(results) == 20


@pytest.mark.django_db
def test_an_empty_query_returns_the_first_page_not_everything(client, reference):
    results = client.get("/api/ingredients/").json()["results"]

    assert len(results) <= 20
