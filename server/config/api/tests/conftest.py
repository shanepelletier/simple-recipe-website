from decimal import Decimal
from types import SimpleNamespace

import pytest
from accounts.models import User
from django.contrib.auth.models import Group, Permission
from django.core.management import call_command
from recipes.models import Ingredient, Recipe, RecipeIngredient, Step, Tag, Unit

PASSWORD = "test-pass-123"


@pytest.fixture
def make_user(db):
    def factory(username="user", **kwargs):
        return User.objects.create_user(username=username, password=PASSWORD, **kwargs)

    return factory


@pytest.fixture
def author(make_user):
    return make_user("author")


@pytest.fixture
def other_user(make_user):
    return make_user("other")


@pytest.fixture
def moderator(make_user):
    user = make_user("moderator")
    group, _ = Group.objects.get_or_create(name="Moderators")
    group.permissions.set(
        Permission.objects.filter(
            content_type__app_label="recipes", codename__startswith="moderate_"
        )
    )
    user.groups.add(group)
    return user


@pytest.fixture
def auth_client(client, author):
    """A test client already signed in as `author`."""
    client.force_login(author)
    return client


@pytest.fixture
def reference(db):
    """The real reference fixture — same units, tags, and ingredients as production."""
    call_command("loaddata", "reference")
    return SimpleNamespace(
        units={unit.name: unit for unit in Unit.objects.all()},
        tags={tag.name: tag for tag in Tag.objects.all()},
        ingredients={item.name: item for item in Ingredient.objects.all()},
    )


@pytest.fixture
def make_recipe(reference):
    def factory(
        owner,
        name="Test Recipe",
        ingredients=(("2", "pound", "ground beef"),),
        steps=("Cook it",),
        tags=(),
    ):
        recipe = Recipe.objects.create(owner=owner, name=name)
        recipe.tags.set([reference.tags[tag] for tag in tags])
        RecipeIngredient.objects.bulk_create(
            RecipeIngredient(
                recipe=recipe,
                ingredient=reference.ingredients[ingredient],
                unit=reference.units[unit],
                quantity=Decimal(quantity),
                position=position,
            )
            for position, (quantity, unit, ingredient) in enumerate(ingredients)
        )
        Step.objects.bulk_create(
            Step(recipe=recipe, text=text, position=position) for position, text in enumerate(steps)
        )
        return recipe

    return factory
