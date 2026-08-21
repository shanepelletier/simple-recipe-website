from types import SimpleNamespace

from recipes.permissions import can_delete_comment, can_edit_recipe


def make_user(id=1, is_authenticated=True, perms=()):
    return SimpleNamespace(
        id=id,
        is_authenticated=is_authenticated,
        has_perm=lambda perm: perm in perms,
    )


def test_can_edit_recipe_denies_anonymous_user():
    user = make_user(is_authenticated=False)
    recipe = SimpleNamespace(owner_id=1)
    assert can_edit_recipe(user, recipe) is False


def test_can_edit_recipe_allows_owner():
    user = make_user(id=1)
    recipe = SimpleNamespace(owner_id=1)
    assert can_edit_recipe(user, recipe) is True


def test_can_edit_recipe_denies_non_owner_without_permission():
    user = make_user(id=2)
    recipe = SimpleNamespace(owner_id=1)
    assert can_edit_recipe(user, recipe) is False


def test_can_edit_recipe_allows_moderator():
    user = make_user(id=2, perms={"recipes.moderate_recipe"})
    recipe = SimpleNamespace(owner_id=1)
    assert can_edit_recipe(user, recipe) is True


def test_can_edit_recipe_ignores_unrelated_permission():
    user = make_user(id=2, perms={"recipes.moderate_comment"})
    recipe = SimpleNamespace(owner_id=1)
    assert can_edit_recipe(user, recipe) is False


def test_can_delete_comment_denies_anonymous_user():
    user = make_user(is_authenticated=False)
    comment = SimpleNamespace(author_id=1)
    assert can_delete_comment(user, comment) is False


def test_can_delete_comment_allows_author():
    user = make_user(id=1)
    comment = SimpleNamespace(author_id=1)
    assert can_delete_comment(user, comment) is True


def test_can_delete_comment_denies_non_author_without_permission():
    user = make_user(id=2)
    comment = SimpleNamespace(author_id=1)
    assert can_delete_comment(user, comment) is False


def test_can_delete_comment_allows_moderator():
    user = make_user(id=2, perms={"recipes.moderate_comment"})
    comment = SimpleNamespace(author_id=1)
    assert can_delete_comment(user, comment) is True


def test_can_delete_comment_ignores_unrelated_permission():
    user = make_user(id=2, perms={"recipes.moderate_recipe"})
    comment = SimpleNamespace(author_id=1)
    assert can_delete_comment(user, comment) is False
