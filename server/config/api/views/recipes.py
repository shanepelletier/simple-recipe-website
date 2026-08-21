from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Case, F, FloatField, Value, When
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from recipes.models import Recipe, RecipeIngredient, Step
from recipes.permissions import can_edit_recipe

from api.http import error, json_body, json_errors, login_required_json
from api.recipe_payload import parse_recipe_payload
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


@login_required_json
def recipe_create(request):
    parsed = parse_recipe_payload(json_body(request))

    with transaction.atomic():
        recipe = Recipe.objects.create(owner=request.user, name=parsed.name)
        recipe.tags.set(parsed.tags)
        _replace_children(recipe, parsed)

    recipe = _detail_queryset().get(pk=recipe.pk)
    return JsonResponse({"recipe": recipe_to_dict(recipe, user=request.user)}, status=201)


def _replace_children(recipe, parsed):
    """Delete and rewrite a recipe's ingredients and steps. Shared by create and update."""
    recipe.ingredients.all().delete()
    recipe.steps.all().delete()
    RecipeIngredient.objects.bulk_create(
        RecipeIngredient(recipe=recipe, position=position, **row)
        for position, row in enumerate(parsed.ingredients)
    )
    Step.objects.bulk_create(
        Step(recipe=recipe, text=text, position=position)
        for position, text in enumerate(parsed.steps)
    )


@require_http_methods(["GET", "POST"])
@json_errors
def recipe_collection(request):
    if request.method == "GET":
        return recipe_list(request)
    return recipe_create(request)


def _detail_queryset():
    return Recipe.objects.select_related("owner", "copied_from").prefetch_related(
        "tags", "steps", "ingredients__ingredient", "ingredients__unit"
    )


def recipe_detail(request, pk):
    recipe = get_object_or_404(_detail_queryset(), pk=pk)
    return JsonResponse({"recipe": recipe_to_dict(recipe, user=request.user)})


@login_required_json
def recipe_update(request, pk):
    recipe = get_object_or_404(Recipe, pk=pk)
    if not can_edit_recipe(request.user, recipe):
        return error("You can only edit your own recipes.", status=403)

    body = json_body(request)
    if "version" not in body:
        return error("Missing version.", fields={"version": ["Reload the page and try again."]})

    parsed = parse_recipe_payload(body)

    with transaction.atomic():
        # The database checks the version and writes in ONE statement.
        updated = Recipe.objects.filter(pk=pk, version=body["version"]).update(
            name=parsed.name,
            version=F("version") + 1,
            # auto_now does NOT fire on a queryset .update(), so set it here
            # or updated_at silently stops moving.
            updated_at=timezone.now(),
        )

        if not updated:
            # "Gone" and "someone else edited it" need different messages.
            if not Recipe.objects.filter(pk=pk).exists():
                return error("That recipe no longer exists.", status=404)
            return error(
                "This recipe was changed by someone else while you were editing. "
                "Reload to see the current version.",
                status=409,
            )

        recipe.refresh_from_db()
        recipe.tags.set(parsed.tags)
        _replace_children(recipe, parsed)

    recipe = _detail_queryset().get(pk=pk)
    return JsonResponse({"recipe": recipe_to_dict(recipe, user=request.user)})


@login_required_json
def recipe_delete(request, pk):
    recipe = get_object_or_404(Recipe, pk=pk)
    if not can_edit_recipe(request.user, recipe):
        return error("You can only delete your own recipes.", status=403)

    recipe.delete()
    return JsonResponse({"deleted": True})


@require_http_methods(["GET", "PATCH", "DELETE"])
@json_errors
def recipe_resource(request, pk):
    if request.method == "GET":
        return recipe_detail(request, pk)
    if request.method == "PATCH":
        return recipe_update(request, pk)
    return recipe_delete(request, pk)
