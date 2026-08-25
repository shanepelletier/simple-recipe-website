from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from recipes.models import Recipe, Review

from api.http import error, json_body, json_errors, login_required_json


def _rating_payload(recipe, rating):
    return JsonResponse(
        {
            "rating": rating,
            "recipe": {
                "id": recipe.id,
                "rating": recipe.rating_average,
                "rating_count": recipe.rating_count,
            },
        }
    )


@login_required_json
def review_upsert(request, pk):
    body = json_body(request)
    try:
        rating = int(body.get("rating"))
    except (TypeError, ValueError):
        return error("Choose a rating.", fields={"rating": ["Choose a rating from 1 to 5."]})

    if not 1 <= rating <= 5:
        return error("Invalid rating.", fields={"rating": ["Choose a rating from 1 to 5."]})

    with transaction.atomic():
        # Lock the recipe row for the rest of the transaction. Without this,
        # two concurrent reviews both read the same rating_sum and the second
        # write silently discards the first.
        recipe = get_object_or_404(Recipe.objects.select_for_update(), pk=pk)

        if recipe.owner_id == request.user.id:
            return error("You can't rate your own recipe.", status=403)

        review, created = Review.objects.get_or_create(
            recipe=recipe, user=request.user, defaults={"rating": rating}
        )

        if created:
            recipe.rating_sum += rating
            recipe.rating_count += 1
        else:
            recipe.rating_sum += rating - review.rating
            review.rating = rating
            review.save(update_fields=["rating"])

        recipe.save(update_fields=["rating_sum", "rating_count"])

    return _rating_payload(recipe, rating)


@login_required_json
def review_delete(request, pk):
    with transaction.atomic():
        recipe = get_object_or_404(Recipe.objects.select_for_update(), pk=pk)
        review = Review.objects.filter(recipe=recipe, user=request.user).first()
        if review is None:
            return error("You have not rated this recipe.", status=404)

        recipe.rating_sum -= review.rating
        recipe.rating_count -= 1
        review.delete()
        recipe.save(update_fields=["rating_sum", "rating_count"])

    return _rating_payload(recipe, None)


@require_http_methods(["PUT", "DELETE"])
@json_errors
def review_resource(request, pk):
    if request.method == "PUT":
        return review_upsert(request, pk)
    return review_delete(request, pk)
