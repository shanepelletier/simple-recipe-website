import json

import pytest
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.test import RequestFactory

from api.http import BadRequest, error, json_body, json_errors, login_required_json


class AnonymousUserStub:
    """Enough of a user for login_required_json. No database needed."""

    is_authenticated = False


def call(view, user=None):
    """Run a view against a bare GET request carrying `user`."""
    request = RequestFactory().get("/")
    request.user = user or AnonymousUserStub()
    return view(request)


def test_json_body_parses_a_valid_body():
    request = RequestFactory().post("/", data=json.dumps({"a": 1}), content_type="application/json")

    assert json_body(request) == {"a": 1}


def test_json_body_treats_an_empty_body_as_an_empty_dict():
    request = RequestFactory().post("/", data="", content_type="application/json")

    assert json_body(request) == {}


def test_json_body_raises_bad_request_on_malformed_json():
    request = RequestFactory().post("/", data="{nope", content_type="application/json")

    with pytest.raises(BadRequest):
        json_body(request)


def test_error_has_the_standard_shape():
    response = error("Nope.", status=422, fields={"name": ["Required."]})

    assert response.status_code == 422
    assert json.loads(response.content) == {"error": "Nope.", "fields": {"name": ["Required."]}}


def test_json_errors_converts_bad_request_to_400():
    @json_errors
    def view(request):
        raise BadRequest("Body must be JSON.")

    response = call(view)

    assert response.status_code == 400
    assert json.loads(response.content)["error"] == "Body must be JSON."


def test_json_errors_converts_field_validation_error_to_the_fields_map():
    @json_errors
    def view(request):
        raise ValidationError({"name": ["This field is required."]})

    response = call(view)

    assert response.status_code == 400
    assert json.loads(response.content)["fields"] == {"name": ["This field is required."]}


def test_json_errors_converts_a_message_only_validation_error():
    @json_errors
    def view(request):
        raise ValidationError("Too big.")

    response = call(view)

    assert json.loads(response.content) == {"error": "Too big.", "fields": {}}


def test_json_errors_passes_a_successful_response_through():
    @json_errors
    def view(request):
        return JsonResponse({"ok": True})

    assert call(view).status_code == 200


def test_login_required_json_returns_401_for_anonymous_users():
    @login_required_json
    def view(request):
        return JsonResponse({"ok": True})

    response = call(view)

    assert response.status_code == 401
