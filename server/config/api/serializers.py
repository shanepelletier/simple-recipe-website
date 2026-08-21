from recipes.format import format_quantity, trim
from recipes.permissions import can_delete_comment, can_edit_recipe


def user_to_dict(user):
    return {
        "id": user.id,
        "username": user.username,
        "is_staff": user.is_staff,
        "is_moderator": user.has_perm("recipes.moderate_recipe"),
    }


def tag_to_dict(tag):
    return {"id": tag.id, "name": tag.name}


def unit_to_dict(unit):
    return {
        "id": unit.id,
        "name": unit.name,
        "plural": unit.plural,
        "abbreviation": unit.abbreviation,
        "category": unit.category,
        "takes_of": unit.takes_of,
    }


def ingredient_to_dict(ingredient):
    return {
        "id": ingredient.id,
        "name": ingredient.name,
        "plural": ingredient.plural,
    }


def recipe_ingredient_to_dict(item):
    return {
        "id": item.id,
        "ingredient": ingredient_to_dict(item.ingredient),
        "unit": unit_to_dict(item.unit),
        "quantity": trim(item.quantity),
        "display": format_quantity(item.quantity, item.unit, item.ingredient),
        "position": item.position,
    }


def step_to_dict(step):
    return {"id": step.id, "text": step.text, "position": step.position}


def recipe_card_to_dict(recipe):
    """The grid card. Deliberately smaller than the detail payload."""
    return {
        "id": recipe.id,
        "name": recipe.name,
        "photo": recipe.photo.url if recipe.photo else None,
        "rating": recipe.rating_average,
        "rating_count": recipe.rating_count,
        "tags": [tag_to_dict(tag) for tag in recipe.tags.all()[:3]],
        "owner": recipe.owner.username,
        "created_at": recipe.created_at.isoformat(),
    }


def recipe_to_dict(recipe, user=None):
    """The detail payload. `user` decides whether the UI shows Edit/Delete."""
    return {
        **recipe_card_to_dict(recipe),
        "tags": [tag_to_dict(tag) for tag in recipe.tags.all()],
        "ingredients": [recipe_ingredient_to_dict(i) for i in recipe.ingredients.all()],
        "steps": [step_to_dict(s) for s in recipe.steps.all()],
        "version": recipe.version,
        "copied_from_id": recipe.copied_from_id,
        "copied_from_username": recipe.copied_from_username,
        "updated_at": recipe.updated_at.isoformat(),
        "can_edit": can_edit_recipe(user, recipe) if user is not None else False,
    }


def review_to_dict(review):
    return {
        "id": review.id,
        "rating": review.rating,
        "user": review.user.username,
        "created_at": review.created_at.isoformat(),
    }


def comment_to_dict(comment, user=None):
    return {
        "id": comment.id,
        "body": comment.body,
        "photo": comment.photo.url if comment.photo else None,
        "author": comment.author.username,
        "created_at": comment.created_at.isoformat(),
        "can_delete": can_delete_comment(user, comment) if user is not None else False,
    }


def shopping_item_to_dict(item):
    return {
        "id": item.id,
        "ingredient": ingredient_to_dict(item.ingredient),
        "unit": unit_to_dict(item.unit),
        "quantity": trim(item.quantity),
        "display": format_quantity(item.quantity, item.unit, item.ingredient),
        "is_checked": item.is_checked,
        "source_recipe_id": item.source_recipe_id,
    }
