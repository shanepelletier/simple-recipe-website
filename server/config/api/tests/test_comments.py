import pytest
from django.test import override_settings
from recipes.models import Comment

from api.tests.test_recipe_photo import make_upload


@pytest.mark.django_db
def test_posting_a_comment_returns_it(auth_client, author, make_recipe):
    recipe = make_recipe(author)

    response = auth_client.post(f"/api/recipes/{recipe.pk}/comments/", {"body": "Delicious"})

    assert response.status_code == 201
    assert response.json()["comment"]["body"] == "Delicious"


@pytest.mark.django_db
def test_posting_a_comment_with_a_photo(auth_client, author, make_recipe, tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        recipe = make_recipe(author)

        response = auth_client.post(
            f"/api/recipes/{recipe.pk}/comments/",
            {"body": "Mine came out like this", "photo": make_upload()},
        )

        assert response.json()["comment"]["photo"].startswith("/media/comments/")


@pytest.mark.django_db
def test_an_empty_comment_is_rejected(auth_client, author, make_recipe):
    recipe = make_recipe(author)

    response = auth_client.post(f"/api/recipes/{recipe.pk}/comments/", {"body": "   "})

    assert response.status_code == 400
    assert "body" in response.json()["fields"]


@pytest.mark.django_db
def test_an_over_long_comment_is_rejected(auth_client, author, make_recipe):
    recipe = make_recipe(author)

    response = auth_client.post(f"/api/recipes/{recipe.pk}/comments/", {"body": "x" * 3001})

    assert response.status_code == 400


@pytest.mark.django_db
def test_a_comment_over_250_words_is_rejected(auth_client, author, make_recipe):
    recipe = make_recipe(author)

    response = auth_client.post(f"/api/recipes/{recipe.pk}/comments/", {"body": "word " * 251})

    assert response.status_code == 400
    assert "body" in response.json()["fields"]


@pytest.mark.django_db
def test_comments_are_listed_newest_first_by_default(client, author, make_recipe):
    recipe = make_recipe(author)
    Comment.objects.create(recipe=recipe, author=author, body="First")
    Comment.objects.create(recipe=recipe, author=author, body="Second")

    body = client.get(f"/api/recipes/{recipe.pk}/comments/").json()

    assert [c["body"] for c in body["results"]] == ["Second", "First"]


@pytest.mark.django_db
def test_sort_oldest_reverses_the_order(client, author, make_recipe):
    recipe = make_recipe(author)
    Comment.objects.create(recipe=recipe, author=author, body="First")
    Comment.objects.create(recipe=recipe, author=author, body="Second")

    body = client.get(f"/api/recipes/{recipe.pk}/comments/?sort=oldest").json()

    assert [c["body"] for c in body["results"]] == ["First", "Second"]


@pytest.mark.django_db
def test_an_unknown_comment_sort_falls_back_instead_of_erroring(client, author, make_recipe):
    recipe = make_recipe(author)
    Comment.objects.create(recipe=recipe, author=author, body="Only")

    response = client.get(f"/api/recipes/{recipe.pk}/comments/?sort=DROP TABLE comments")

    assert response.status_code == 200
    assert response.json()["results"][0]["body"] == "Only"


@pytest.mark.django_db
def test_listing_comments_is_a_fixed_number_of_queries(
    client, author, make_recipe, django_assert_num_queries
):
    recipe = make_recipe(author)
    for index in range(10):
        Comment.objects.create(recipe=recipe, author=author, body=f"Comment {index}")

    with django_assert_num_queries(3):
        client.get(f"/api/recipes/{recipe.pk}/comments/")


@pytest.mark.django_db
def test_an_author_can_delete_their_own_comment(auth_client, author, make_recipe):
    recipe = make_recipe(author)
    comment = Comment.objects.create(recipe=recipe, author=author, body="Oops")

    assert auth_client.delete(f"/api/comments/{comment.pk}/").status_code == 200
    assert not Comment.objects.filter(pk=comment.pk).exists()


@pytest.mark.django_db
def test_a_stranger_cannot_delete_someone_elses_comment(client, author, other_user, make_recipe):
    recipe = make_recipe(author)
    comment = Comment.objects.create(recipe=recipe, author=author, body="Mine")
    client.force_login(other_user)

    assert client.delete(f"/api/comments/{comment.pk}/").status_code == 403


@pytest.mark.django_db
def test_a_moderator_can_delete_any_comment(client, author, moderator, make_recipe):
    recipe = make_recipe(author)
    comment = Comment.objects.create(recipe=recipe, author=author, body="Mine")
    client.force_login(moderator)

    assert client.delete(f"/api/comments/{comment.pk}/").status_code == 200


@pytest.mark.django_db
def test_posting_requires_a_signed_in_user(client, author, make_recipe):
    recipe = make_recipe(author)

    assert client.post(f"/api/recipes/{recipe.pk}/comments/", {"body": "Hi"}).status_code == 401
