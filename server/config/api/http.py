import json
from decimal import Decimal, InvalidOperation
from functools import wraps

from django.core.exceptions import ValidationError
from django.http import JsonResponse


class BadRequest(Exception):
    pass


def json_body(request) -> dict:
    """Parse a JSON request body, raising a clean error for malformed input."""
    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        raise BadRequest("Request body must be valid JSON.") from None
    if not isinstance(body, dict):
        # Every caller does body.get(...) next. A JSON list, string, number,
        # or null parses fine but isn't shaped like a request body, and
        # AttributeError from the .get() downstream isn't caught anywhere.
        raise BadRequest("Request body must be a JSON object.") from None
    return body


def parse_id(raw) -> int | None:
    """Coerce a user-supplied id to int, or None if it isn't one.

    Guards every place a raw JSON value reaches the ORM as a primary key.
    Django's query preparation raises ValueError/TypeError for anything that
    isn't already int-shaped (e.g. `pk="x"`), which nothing upstream catches —
    callers should treat None as "no such row" rather than pass it through.
    """
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw
    return None


# Exclusive upper bound on a quantity, matching the quantity fields'
# max_digits=10, decimal_places=3 (RecipeIngredient, ShoppingItem): at most 7
# integer digits. Kept here, not derived from the model, since both callers
# already import from this module rather than from recipes.models.
MAX_QUANTITY = Decimal(10**7)


def parse_quantity(raw) -> Decimal | None:
    """Parse a user-supplied quantity, or return None if it isn't usable.

    Checks `is_finite()` before any comparison — comparing a NaN or Infinity
    Decimal raises InvalidOperation rather than returning a boolean, so a
    plain `quantity <= 0` check crashes instead of rejecting it. Also rejects
    anything that would overflow the DB column's digit count, which
    Postgres reports as an uncaught DataError rather than a validation error.
    """
    try:
        quantity = Decimal(str(raw).strip())
    except (InvalidOperation, AttributeError, TypeError):
        return None
    if not quantity.is_finite() or quantity <= 0 or quantity >= MAX_QUANTITY:
        return None
    return quantity


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
            return error(str(exc), fields=getattr(exc, "fields", None))
        except ValidationError as exc:
            # `error_dict` exists only when the ValidationError was raised
            # with a {field: message} dict — model full_clean() does that.
            if hasattr(exc, "error_dict"):
                return error("Please correct the errors below.", fields=exc.message_dict)
            return error(" ".join(exc.messages))

    return wrapper
