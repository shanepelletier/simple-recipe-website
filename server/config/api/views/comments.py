from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from recipes.models import Comment, Recipe
from recipes.permissions import can_delete_comment

from api.http import error, json_errors, login_required_json
from api.serializers import comment_to_dict

PAGE_SIZE = 20

# Same whitelist pattern as the recipe grid's SORTS (task 2.7): never let
# user input reach order_by() directly. "oldest" needs no new index —
# Postgres can scan the existing Comment(recipe, -created_at) index
# backwards to serve ascending order just as well as descending.
COMMENT_SORTS = {
    "newest": "-created_at",
    "oldest": "created_at",
}


def comment_list(request, pk):
    recipe = get_object_or_404(Recipe, pk=pk)
    sort = COMMENT_SORTS.get(request.GET.get("sort"), COMMENT_SORTS["newest"])
    comments = recipe.comments.select_related("author").order_by(sort)
    page = Paginator(comments, PAGE_SIZE).get_page(request.GET.get("page"))
    return JsonResponse(
        {
            "results": [comment_to_dict(c, user=request.user) for c in page],
            "page": page.number,
            "pages": page.paginator.num_pages,
            "total": page.paginator.count,
        }
    )


@login_required_json
def comment_create(request, pk):
    recipe = get_object_or_404(Recipe, pk=pk)

    # multipart, NOT JSON — the photo rides along in the same request.
    body = (request.POST.get("body") or "").strip()
    if not body:
        return error("Write something first.", fields={"body": ["Write something first."]})

    comment = Comment(
        recipe=recipe, author=request.user, body=body, photo=request.FILES.get("photo")
    )
    # Runs validate_image on the photo, the 3000-character cap, and the
    # 250-word cap on the body.
    comment.full_clean()
    comment.save()

    return JsonResponse({"comment": comment_to_dict(comment, user=request.user)}, status=201)


@require_http_methods(["GET", "POST"])
@json_errors
def comment_collection(request, pk):
    if request.method == "GET":
        return comment_list(request, pk)
    return comment_create(request, pk)


@require_http_methods(["DELETE"])
@json_errors
@login_required_json
def comment_delete(request, pk):
    comment = get_object_or_404(Comment, pk=pk)
    if not can_delete_comment(request.user, comment):
        return error("You can only delete your own comments.", status=403)

    comment.delete()
    return JsonResponse({"deleted": True})
