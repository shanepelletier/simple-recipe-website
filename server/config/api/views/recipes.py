from django.core.paginator import Paginator
from django.db.models import Case, F, FloatField, Value, When
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from recipes.models import Recipe

from api.http import json_errors
from api.serializers import recipe_card_to_dict

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

    tag = (params.get("tag") or "").strip()
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
