def can_edit_recipe(user, recipe):
    if not user.is_authenticated:
        return False
    return recipe.owner_id == user.id or user.has_perm("recipes.moderate_recipe")


def can_delete_comment(user, comment):
    if not user.is_authenticated:
        return False
    return comment.author_id == user.id or user.has_perm("recipes.moderate_comment")
