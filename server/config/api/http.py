import json
from functools import wraps

from django.core.exceptions import ValidationError
from django.http import JsonResponse


class BadRequest(Exception):
    pass


def json_body(request) -> dict:
    """Parse a JSON request body, raising a clean error for malformed input."""
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError:
        raise BadRequest("Request body must be valid JSON.") from None


def error(message: str, status: int = 400, fields: dict | None = None) -> JsonResponse:
    """Every error in the API has this shape, so the frontend has one code path."""
    return JsonResponse({"error": message, "fields": fields or {}}, status=status)


def login_required_json(view):
    """Like @login_required but returns 401 JSON instead of redirecting to HTML."""

    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return error("You must be signed in to do that.", status=401)
        return view(request, *args, **kwargs)

    return wrapper


def json_errors(view):
    """Convert BadRequest and model ValidationError into the standard envelope.

    Put this on every view. Without it a malformed body is a 500, and a
    model's own validation message never reaches the user.
    """

    @wraps(view)
    def wrapper(request, *args, **kwargs):
        try:
            return view(request, *args, **kwargs)
        except BadRequest as exc:
            return error(str(exc))
        except ValidationError as exc:
            # `error_dict` exists only when the ValidationError was raised
            # with a {field: message} dict — model full_clean() does that.
            if hasattr(exc, "error_dict"):
                return error("Please correct the errors below.", fields=exc.message_dict)
            return error(" ".join(exc.messages))

    return wrapper
