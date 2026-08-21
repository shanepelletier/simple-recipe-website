from accounts.models import User
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from api.http import error, json_body, json_errors, login_required_json
from api.serializers import user_to_dict


@require_http_methods(["POST"])
@json_errors
def register(request):
    body = json_body(request)
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    fields = {}
    if not username:
        fields["username"] = ["Please choose a username."]
    elif User.objects.filter(username__iexact=username).exists():
        fields["username"] = ["That username is already taken."]

    try:
        validate_password(password)
    except ValidationError as exc:
        fields["password"] = list(exc.messages)

    if fields:
        return error("Please correct the errors below.", fields=fields)

    with transaction.atomic():
        user = User.objects.create_user(username=username, password=password)
        authors, _ = Group.objects.get_or_create(name="Authors")
        user.groups.add(authors)

    login(request, user)
    return JsonResponse({"user": user_to_dict(user)}, status=201)


@require_http_methods(["POST"])
@json_errors
def log_in(request):
    body = json_body(request)
    user = authenticate(
        request,
        username=(body.get("username") or "").strip(),
        password=body.get("password") or "",
    )
    if user is None:
        # One message for both cases on purpose: saying "no such user"
        # tells an attacker which usernames exist.
        return error("Username or password is incorrect.", status=401)

    login(request, user)
    return JsonResponse({"user": user_to_dict(user)})


@require_http_methods(["POST"])
@login_required_json
def log_out(request):
    logout(request)
    return JsonResponse({"user": None})


@ensure_csrf_cookie
@require_http_methods(["GET"])
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({"user": None})
    return JsonResponse({"user": user_to_dict(request.user)})
