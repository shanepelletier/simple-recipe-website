import pytest
from django.test import Client
from django.urls import reverse

from api.urls import urlpatterns

# Routes where an anonymous WRITE is intentional. Kept short and explicit on
# purpose: everything else in api/urls.py is swept automatically below by
# iterating the real URLconf, so a route that should require sign-in but
# doesn't fails THIS test instead of silently missing coverage because
# someone forgot to add it to a list. Landing a route in this allowlist, by
# contrast, is a deliberate opt-in a reviewer can't miss in a diff.
PUBLIC_WRITE_ROUTES = {"register", "login"}

# The mirror image: routes where an anonymous READ is intentionally blocked.
# Just as short, for the same reason — everything else is swept as "must
# never require sign-in," so a route that starts requiring auth unexpectedly
# (or a genuinely private route that forgets to) shows up here instead of
# silently escaping coverage.
PRIVATE_READ_ROUTES = {"shopping-list"}

WRITE_METHODS = ["post", "patch", "put", "delete"]


def _concrete_path(url_pattern):
    """Reverse a URL pattern, substituting 1 for every int path parameter."""
    converters = getattr(url_pattern.pattern, "converters", {})
    return reverse(f"api:{url_pattern.name}", kwargs=dict.fromkeys(converters, 1))


def _write_cases():
    """(method, path) for every write method on every non-public route.

    Built from the live urlpatterns list, not a hand-copied inventory —
    adding a new path() in api/urls.py means it is swept here for free.
    """
    return [
        pytest.param(method, _concrete_path(pattern), id=f"{pattern.name}-{method}")
        for pattern in urlpatterns
        if pattern.name not in PUBLIC_WRITE_ROUTES
        for method in WRITE_METHODS
    ]


def _public_read_cases():
    return [
        pytest.param(_concrete_path(pattern), id=pattern.name)
        for pattern in urlpatterns
        if pattern.name not in PRIVATE_READ_ROUTES
    ]


def _private_read_cases():
    return [
        pytest.param(_concrete_path(pattern), id=pattern.name)
        for pattern in urlpatterns
        if pattern.name in PRIVATE_READ_ROUTES
    ]


@pytest.mark.django_db
@pytest.mark.parametrize(("method", "path"), _write_cases())
def test_anonymous_writes_require_sign_in(client, author, method, path):
    """An anonymous request must be rejected with 401 whenever a signed-in
    user could reach that same method+path at all.

    This is a comparison, not a fixed status-code check, because "not 2xx"
    is too weak a proxy for "requires sign-in": a route can reject a junk
    {} body with 400 for reasons that have nothing to do with who's
    calling (e.g. shopping-list's "enter a quantity"), which would make an
    anonymous request LOOK correctly rejected even with @login_required_json
    missing entirely. Probing with a signed-in user first tells us whether
    the method is genuinely handled here (a signed-in user gets anything
    other than 405) — and if it is, the anonymous version must be exactly
    401, not merely "also non-2xx for an unrelated reason."

    Uses a fresh Client() rather than the auth_client fixture: auth_client
    just force_logs_in the SAME `client` fixture object rather than
    returning an independent instance, so requesting both in one test
    would silently leave "anonymous" signed in as `author` too.
    """
    signed_in = Client()
    signed_in.force_login(author)

    authenticated = getattr(signed_in, method)(path, data="{}", content_type="application/json")
    if authenticated.status_code == 405:
        pytest.skip(f"{method.upper()} is not accepted at {path}")

    anonymous = getattr(client, method)(path, data="{}", content_type="application/json")

    assert anonymous.status_code == 401, (
        f"{method.upper()} {path} is reachable when signed in "
        f"({authenticated.status_code}), but anonymous got {anonymous.status_code}, not 401"
    )


@pytest.mark.django_db
@pytest.mark.parametrize("path", _public_read_cases())
def test_public_read_endpoints_never_require_sign_in(client, path):
    """A GET against any non-private route must never be rejected for being
    anonymous. 405 (method not supported at all) and 404 (nothing at this
    id) are both fine here — neither means "you must sign in first."
    """
    assert client.get(path).status_code not in (401, 403)


@pytest.mark.django_db
@pytest.mark.parametrize("path", _private_read_cases())
def test_private_read_endpoints_require_sign_in(client, path):
    assert client.get(path).status_code == 401
