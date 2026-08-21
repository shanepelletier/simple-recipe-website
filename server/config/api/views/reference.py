from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from recipes.models import Ingredient, Tag, Unit

from api.http import json_errors
from api.serializers import ingredient_to_dict, tag_to_dict, unit_to_dict

AUTOCOMPLETE_LIMIT = 20


@require_http_methods(["GET"])
@json_errors
def tag_list(request):
    return JsonResponse({"results": [tag_to_dict(tag) for tag in Tag.objects.all()]})


@require_http_methods(["GET"])
@json_errors
def unit_list(request):
    """Grouped by category so the picker can render <optgroup> headings."""
    units = list(Unit.objects.all())
    groups = [
        {
            "category": value,
            "label": label,
            "units": [unit_to_dict(u) for u in units if u.category == value],
        }
        for value, label in Unit.Category.choices
    ]
    return JsonResponse({"groups": groups})


@require_http_methods(["GET"])
@json_errors
def ingredient_list(request):
    query = Ingredient.normalize(request.GET.get("q", ""))
    ingredients = Ingredient.objects.all()
    if query:
        ingredients = ingredients.filter(normalized_name__startswith=query)

    # Always capped. With the bulk seed loaded this table is big enough that
    # an uncapped query is a real mistake, not a theoretical one.
    results = [ingredient_to_dict(i) for i in ingredients[:AUTOCOMPLETE_LIMIT]]
    return JsonResponse({"results": results})
