# Summary

The application is composed of two parts, the backend in Django and the frontend in React. Deployment is via `docker compose up`.

# Backend

The backend is plain Django views returning `JsonResponse` instead of using a framework like [Django REST Framework (DRF)](https://www.django-rest-framework.org/). The API is fairly small, and using the machinery that DRF provides would have made development more complicated rather than simpler. In addition, a guiding goal throughout the project has been to use the minimum amount of dependencies necessary.

The Python dependencies used in production are:

- Django, which is used for all APIs
- Pillow, for validating images
- psycopg, for accessing a Postgres DB

For development a few more dependencies are added:

- pytest and pytest-django, for automated testing
- mypy and django-stubs, for type checking
- ruff, for code formatting

The Django project consists of two apps and the `api` package.

## The `accounts` app

Owns the `User` model and its admin registration. A small custom `User` model was created for ease of future extension; for example, allowing users to log in via email instead of by username.

## The `recipes` app

Owns the `Recipe` model, its admin registration, a fixture for the demo website, and a seed management command for seeding the demo. The fixture provides data for the `Unit`, `Tag`, and `Ingredient` models which are necessary for both the bulk demo and the standard demo to run.

## The `api` package

Provides the HTTP JSON API that translates between Django models and HTTP request/response payloads. The frontend only communicates with the HTTP API, and has no knowledge of Django (the frontend runs on an entirely different container).
