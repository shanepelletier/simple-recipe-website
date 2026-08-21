import json

import pytest
from accounts.models import User
from django.contrib.auth.models import Group

from api.tests.conftest import PASSWORD


def post_json(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type="application/json")


@pytest.mark.django_db
def test_register_creates_a_user_and_signs_them_in(client):
    response = post_json(
        client, "/api/auth/register/", {"username": "newbie", "password": "good-pass-123"}
    )

    assert response.status_code == 201
    assert response.json()["user"]["username"] == "newbie"
    assert client.get("/api/auth/me/").json()["user"]["username"] == "newbie"


@pytest.mark.django_db
def test_register_adds_the_new_user_to_the_authors_group(client):
    post_json(client, "/api/auth/register/", {"username": "newbie", "password": "good-pass-123"})

    user = User.objects.get(username="newbie")
    assert user.groups.filter(name="Authors").exists()


@pytest.mark.django_db
def test_register_works_when_the_authors_group_does_not_exist_yet(client):
    Group.objects.filter(name="Authors").delete()

    response = post_json(
        client, "/api/auth/register/", {"username": "newbie", "password": "good-pass-123"}
    )

    assert response.status_code == 201


@pytest.mark.django_db
def test_register_rejects_a_duplicate_username(client, author):
    response = post_json(
        client, "/api/auth/register/", {"username": "author", "password": "good-pass-123"}
    )

    assert response.status_code == 400
    assert "username" in response.json()["fields"]


@pytest.mark.django_db
def test_register_rejects_a_weak_password(client):
    response = post_json(client, "/api/auth/register/", {"username": "newbie", "password": "123"})

    assert response.status_code == 400
    assert "password" in response.json()["fields"]


@pytest.mark.django_db
def test_register_rejects_a_malformed_body(client):
    response = client.post("/api/auth/register/", data="{not json", content_type="application/json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_login_succeeds_with_correct_credentials(client, author):
    response = post_json(client, "/api/auth/login/", {"username": "author", "password": PASSWORD})

    assert response.status_code == 200
    assert response.json()["user"]["username"] == "author"


@pytest.mark.django_db
def test_login_fails_with_a_wrong_password(client, author):
    response = post_json(client, "/api/auth/login/", {"username": "author", "password": "wrong"})

    assert response.status_code == 401


@pytest.mark.django_db
def test_logout_ends_the_session(auth_client):
    auth_client.post("/api/auth/logout/")

    assert auth_client.get("/api/auth/me/").json()["user"] is None


@pytest.mark.django_db
def test_logout_requires_a_signed_in_user(client):
    assert client.post("/api/auth/logout/").status_code == 401


@pytest.mark.django_db
def test_me_returns_null_for_anonymous_users(client):
    assert client.get("/api/auth/me/").json()["user"] is None


@pytest.mark.django_db
def test_me_sets_the_csrf_cookie(client):
    response = client.get("/api/auth/me/")

    assert "csrftoken" in response.cookies


@pytest.mark.django_db
def test_me_rejects_a_post(client):
    assert client.post("/api/auth/me/").status_code == 405
