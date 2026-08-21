from decimal import Decimal
from pathlib import Path

import pytest
from accounts.models import User
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.test import override_settings

from recipes.models import Ingredient, Recipe, RecipeIngredient, Review, ShoppingItem, Tag, Unit


def make_user(username="user"):
    return User.objects.create_user(username=username, password="test-pass-123")


def make_unit(name="pound", plural="pounds", category=Unit.Category.MASS, takes_of=True):
    return Unit.objects.create(name=name, plural=plural, category=category, takes_of=takes_of)


def make_ingredient(name="beef"):
    return Ingredient.objects.create(name=name, plural=name)


def make_recipe(owner=None, name="Test Recipe"):
    return Recipe.objects.create(owner=owner or make_user(), name=name)


@pytest.mark.django_db
def test_duplicate_review_by_same_user_raises_integrity_error():
    recipe = make_recipe(owner=make_user("owner"))
    user = make_user("reviewer")
    Review.objects.create(recipe=recipe, user=user, rating=5)

    with pytest.raises(IntegrityError), transaction.atomic():
        Review.objects.create(recipe=recipe, user=user, rating=3)


@pytest.mark.django_db
def test_reviews_by_different_users_both_succeed():
    recipe = make_recipe()
    user_a = make_user("alice")
    user_b = make_user("bob")

    Review.objects.create(recipe=recipe, user=user_a, rating=5)
    Review.objects.create(recipe=recipe, user=user_b, rating=3)

    assert Review.objects.filter(recipe=recipe).count() == 2


@pytest.mark.django_db
def test_recipe_ingredient_zero_quantity_raises_integrity_error():
    recipe = make_recipe()
    ingredient = make_ingredient()
    unit = make_unit()

    with pytest.raises(IntegrityError), transaction.atomic():
        RecipeIngredient.objects.create(
            recipe=recipe, ingredient=ingredient, unit=unit, quantity=Decimal("0"), position=0
        )


def test_ingredient_normalize_strips_whitespace_and_case():
    assert Ingredient.normalize(" Tomato ") == Ingredient.normalize("tomato")


@pytest.mark.django_db
def test_recipe_tags_are_alphabetically_ordered_regardless_of_add_order():
    recipe = make_recipe()
    zesty = Tag.objects.create(name="zesty")
    appetizer = Tag.objects.create(name="appetizer")
    main = Tag.objects.create(name="main")

    recipe.tags.add(zesty, appetizer, main)

    assert list(recipe.tags.values_list("name", flat=True)) == ["appetizer", "main", "zesty"]


@pytest.mark.django_db
def test_deleting_recipe_removes_photo_file(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        recipe = make_recipe()
        recipe.photo = ContentFile(b"fake-image-bytes", name="test.jpg")
        recipe.save()

        photo_path = recipe.photo.path
        assert photo_path.startswith(str(tmp_path))
        assert Path(photo_path).exists()

        recipe.delete()

        assert not Path(photo_path).exists()


@pytest.mark.django_db
def test_recipe_clean_raises_when_tags_exceed_max():
    recipe = make_recipe()
    tags = [Tag.objects.create(name=f"tag{i}") for i in range(settings.MAX_TAGS_PER_RECIPE + 1)]
    recipe.tags.add(*tags)

    with pytest.raises(ValidationError):
        recipe.clean()


@pytest.mark.django_db
def test_recipe_clean_allows_tags_at_max():
    recipe = make_recipe()
    tags = [Tag.objects.create(name=f"tag{i}") for i in range(settings.MAX_TAGS_PER_RECIPE)]
    recipe.tags.add(*tags)

    recipe.clean()


@pytest.mark.django_db
def test_rating_average_is_none_with_no_reviews():
    recipe = make_recipe()

    assert recipe.rating_average is None


@pytest.mark.django_db
def test_rating_average_computes_mean_of_sum_and_count():
    recipe = make_recipe()
    recipe.rating_sum = 12
    recipe.rating_count = 5

    assert recipe.rating_average == 2.4


@pytest.mark.django_db
def test_rating_average_rounds_to_two_decimal_places():
    recipe = make_recipe()
    recipe.rating_sum = 10
    recipe.rating_count = 3

    assert recipe.rating_average == 3.33


@pytest.mark.django_db
def test_deleting_recipe_leaves_shopping_items_with_null_source():
    recipe = make_recipe(owner=make_user("owner"))
    ingredient = make_ingredient()
    unit = make_unit()
    user = make_user("shopper")
    item = ShoppingItem.objects.create(
        user=user, ingredient=ingredient, unit=unit, quantity=Decimal("2"), source_recipe=recipe
    )

    recipe.delete()
    item.refresh_from_db()

    assert item.source_recipe is None
