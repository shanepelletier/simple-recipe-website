from django.core.paginator import Paginator
from django.db.models import Case, F, FloatField, Value, When
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from recipes.models import Recipe

from api.http import json_errors
from api.serializers import recipe_card_to_dict, recipe_to_dict

PAGE_SIZE = 24

# Never interpolate user input into order_by(). An unknown key falls back to
# "newest" instead of erroring or letting the caller choose arbitrary SQL.
SORTS = {
    "newest": "-created_at",
    "oldest": "created_at",
    "name": "name",
    "rating": "-rating_average_calc",
}

RATING_AVERAGE = Case(
    When(rating_count=0, then=Value(0.0)),
    default=F("rating_sum") * 1.0 / F("rating_count"),
    output_field=FloatField(),
)


def _filtered_recipes(params):
    recipes = (
        Recipe.objects.select_related("owner")  # kills one query per card
        .prefetch_related("tags")  # kills one query per card
        .annotate(rating_average_calc=RATING_AVERAGE)
    )

    search = (params.get("search") or "").strip()
    if search:
        recipes = recipes.filter(name__icontains=search)

    # Repeated ?tag=x&tag=y. Chaining one .filter() per tag (rather than a
    # single tags__name__in=[...]) is what gives AND semantics on an M2M —
    # each call joins the through table again, so a recipe must carry every
    # requested tag, and no .distinct() is needed to avoid duplicate rows.
    for tag in params.getlist("tag"):
        tag = tag.strip()
        if tag:
            recipes = recipes.filter(tags__name=tag)

    author = (params.get("author") or "").strip()
    if author:
        recipes = recipes.filter(owner__username=author)

    min_rating = (params.get("min_rating") or "").strip()
    if min_rating:
        try:
            recipes = recipes.filter(rating_average_calc__gte=float(min_rating))
        except ValueError:
            pass  # An unparseable filter is ignored, not a 500.

    return recipes.order_by(SORTS.get(params.get("sort"), SORTS["newest"]))


@require_http_methods(["GET"])
@json_errors
def recipe_list(request):
    page = Paginator(_filtered_recipes(request.GET), PAGE_SIZE).get_page(request.GET.get("page"))
    return JsonResponse(
        {
            "results": [recipe_card_to_dict(recipe) for recipe in page],
            "page": page.number,
            "pages": page.paginator.num_pages,
            "total": page.paginator.count,
        }
    )


def _detail_queryset():
    return Recipe.objects.select_related("owner", "copied_from").prefetch_related(
        "tags", "steps", "ingredients__ingredient", "ingredients__unit"
    )


@require_http_methods(["GET"])
@json_errors
def recipe_detail(request, pk):
    recipe = get_object_or_404(_detail_queryset(), pk=pk)
    return JsonResponse({"recipe": recipe_to_dict(recipe, user=request.user)})
