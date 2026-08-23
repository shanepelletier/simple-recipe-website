from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from django.conf import settings
from recipes.models import Ingredient, Tag, Unit

from api.http import BadRequest


@dataclass
class ParsedRecipe:
    name: str
    tags: list[Tag]
    ingredients: list[dict]  # {"ingredient": Ingredient, "unit": Unit, "quantity": Decimal}
    steps: list[str]


def parse_recipe_payload(body: dict) -> ParsedRecipe:
    """Validate an incoming recipe body, or raise BadRequest with a field map.

    Everything is checked BEFORE anything is written, so a rejected request
    never leaves a half-built recipe behind.
    """
    fields: dict[str, list[str]] = {}

    name = (body.get("name") or "").strip()
    if not name:
        fields["name"] = ["Please give the recipe a name."]
    elif len(name) > 200:
        fields["name"] = ["Name must be 200 characters or fewer."]

    tags = _parse_tags(body.get("tags") or [], fields)
    ingredients = _parse_ingredients(body.get("ingredients") or [], fields)
    steps = _parse_steps(body.get("steps") or [], fields)

    if fields:
        raise RecipeInvalid(fields)

    return ParsedRecipe(name=name, tags=tags, ingredients=ingredients, steps=steps)


class RecipeInvalid(BadRequest):
    """Carries a {field: [messages]} map up to the view."""

    def __init__(self, fields: dict):
        super().__init__("Please correct the errors below.")
        self.fields = fields


def _parse_tags(raw, fields):
    if not isinstance(raw, list):
        fields["tags"] = ["Tags must be a list of ids."]
        return []
    if len(raw) > settings.MAX_TAGS_PER_RECIPE:
        fields["tags"] = [f"A recipe can have at most {settings.MAX_TAGS_PER_RECIPE} tags."]
        return []

    tags = list(Tag.objects.filter(id__in=raw))
    if len(tags) != len(set(raw)):
        fields["tags"] = ["One of those tags no longer exists."]
    return tags


def _parse_ingredients(raw, fields):
    if not isinstance(raw, list) or not raw:
        fields["ingredients"] = ["Add at least one ingredient."]
        return []

    # One query for every unit rather than one per row (a long ingredient
    # list would otherwise cost one query per row). Safe to load in full
    # because, unlike ingredients, units aren't user-created — admins curate
    # a small, deliberately short list of measurements, so this table never
    # grows to a size where loading it all is a problem.
    units = Unit.objects.in_bulk()
    parsed, messages = [], []

    for index, row in enumerate(raw):
        label = f"Ingredient {index + 1}"
        try:
            quantity = Decimal(str(row.get("quantity", "")).strip())
        except (InvalidOperation, AttributeError):
            messages.append(f"{label}: quantity must be a number.")
            continue
        if quantity <= 0:
            messages.append(f"{label}: quantity must be greater than zero.")
            continue

        unit = units.get(row.get("unit_id"))
        if unit is None:
            messages.append(f"{label}: choose a measurement.")
            continue

        ingredient = _resolve_ingredient(row)
        if ingredient is None:
            messages.append(f"{label}: choose or name an ingredient.")
            continue

        parsed.append({"ingredient": ingredient, "unit": unit, "quantity": quantity})

    if messages:
        fields["ingredients"] = messages
    return parsed


def _resolve_ingredient(row):
    """Accept an existing id, or create one from a typed-in name."""
    if row.get("ingredient_id"):
        return Ingredient.objects.filter(pk=row["ingredient_id"]).first()

    name = (row.get("ingredient_name") or "").strip()
    if not name:
        return None

    normalized = Ingredient.normalize(name)
    if not normalized:
        return None

    ingredient, _ = Ingredient.objects.get_or_create(
        normalized_name=normalized,
        # A user typing a new ingredient can't be asked for its plural, so
        # guess. Wrong for "okra"/"okra" — one of the reasons admins can
        # edit ingredients after the fact.
        defaults={"name": name, "plural": f"{name}s"},
    )
    return ingredient


def _parse_steps(raw, fields):
    if not isinstance(raw, list):
        fields["steps"] = ["Steps must be a list."]
        return []

    steps = [str(text).strip() for text in raw if str(text).strip()]
    if not steps:
        fields["steps"] = ["Add at least one step."]
    return steps
