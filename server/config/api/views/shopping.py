from decimal import Decimal, InvalidOperation
from itertools import groupby

from django.db import transaction
from django.db.models import F
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from recipes.models import Ingredient, Recipe, ShoppingItem, Unit

from api.http import error, json_body, json_errors, login_required_json
from api.serializers import shopping_item_to_dict


def _user_items(user):
    """ALWAYS filter by the signed-in user. Never trust an id from the URL."""
    return (
        ShoppingItem.objects.filter(user=user)
        .select_related("ingredient", "unit")
        .order_by("ingredient__name", "unit__name")
    )


def shopping_list(request):
    items = list(_user_items(request.user))
    groups = [
        {
            "ingredient": ingredient_name,
            "items": [shopping_item_to_dict(item) for item in rows],
        }
        for ingredient_name, rows in groupby(items, key=lambda item: item.ingredient.name)
    ]
    return JsonResponse({"groups": groups})


def add_to_list(user, ingredient, unit, quantity, source_recipe=None):
    """The single merge point. Every path that adds an item calls this."""
    item, created = ShoppingItem.objects.get_or_create(
        user=user,
        ingredient=ingredient,
        unit=unit,
        defaults={"quantity": quantity, "source_recipe": source_recipe},
    )
    if not created:
        # F() so the addition happens IN the database, not in Python. Two
        # simultaneous adds both land instead of one overwriting the other.
        ShoppingItem.objects.filter(pk=item.pk).update(quantity=F("quantity") + quantity)
        item.refresh_from_db()
    return item


def _parse_quantity(raw):
    try:
        quantity = Decimal(str(raw).strip())
    except (InvalidOperation, AttributeError, TypeError):
        return None
    return quantity if quantity > 0 else None


@login_required_json
def shopping_add(request):
    body = json_body(request)

    quantity = _parse_quantity(body.get("quantity"))
    if quantity is None:
        return error(
            "Enter a quantity.", fields={"quantity": ["Enter a number greater than zero."]}
        )

    ingredient = Ingredient.objects.filter(pk=body.get("ingredient_id")).first()
    unit = Unit.objects.filter(pk=body.get("unit_id")).first()
    if ingredient is None or unit is None:
        return error(
            "Choose an ingredient and a measurement.",
            fields={"ingredient_id": ["Choose an ingredient and a measurement."]},
        )

    with transaction.atomic():
        item = add_to_list(request.user, ingredient, unit, quantity)

    return JsonResponse({"item": shopping_item_to_dict(item)}, status=201)


@require_http_methods(["GET", "POST"])
@json_errors
@login_required_json
def shopping_collection(request):
    if request.method == "GET":
        return shopping_list(request)
    return shopping_add(request)


@require_http_methods(["POST"])
@json_errors
@login_required_json
def shopping_add_from_recipe(request, pk):
    recipe = get_object_or_404(
        Recipe.objects.prefetch_related("ingredients__ingredient", "ingredients__unit"), pk=pk
    )

    with transaction.atomic():
        for row in recipe.ingredients.all():
            add_to_list(request.user, row.ingredient, row.unit, row.quantity, source_recipe=recipe)

    return shopping_list(request)


@login_required_json
def shopping_update(request, pk):
    # filter(user=...) is the authorization check. A .get(pk=pk) here would
    # let anyone edit anyone's list by guessing an id.
    item = get_object_or_404(_user_items(request.user), pk=pk)
    body = json_body(request)

    if "is_checked" in body:
        item.is_checked = bool(body["is_checked"])

    if "quantity" in body:
        quantity = _parse_quantity(body["quantity"])
        if quantity is None:
            return error(
                "Enter a quantity.", fields={"quantity": ["Enter a number greater than zero."]}
            )
        item.quantity = quantity

    item.save(update_fields=["is_checked", "quantity"])
    return JsonResponse({"item": shopping_item_to_dict(item)})


@login_required_json
def shopping_delete(request, pk):
    item = get_object_or_404(_user_items(request.user), pk=pk)
    item.delete()
    return JsonResponse({"deleted": True})


@require_http_methods(["PATCH", "DELETE"])
@json_errors
@login_required_json
def shopping_resource(request, pk):
    if request.method == "PATCH":
        return shopping_update(request, pk)
    return shopping_delete(request, pk)
