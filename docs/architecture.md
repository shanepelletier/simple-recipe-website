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

## Brief summary of file contents

The important files in the backend are as follows.

(Despite this being common in AI-generated documentation, this was 100% done by hand, by generating the listing using `tree` and editing the output)

```
config/
├── accounts/                           The accounts application
│   ├── admin.py                        Registers the custom User model with the Django-provided admin interface
│   ├── models.py                       The Django model for the custom user model
├── api/
│   ├── errors.py                       Used to render JSON errors for 404 and 500 responses in production
│   ├── http.py                         Helpers and decorators for working with JSON in Django views
│   ├── recipe_payload.py               A helper to parse and validate a raw dict converted from JSON into a recipe
│   ├── serializers.py                  Helpers to serialize Django models into dicts to be returned as JsonResponse from views
│   ├── tests/                          Tests for all API functionality
│   ├── urls.py                         Defines all URLs in the API
│   └── views/                          Provides the functions to handle all API requests and responses
├── config/                             Django boilerplate; provides custom 404 and 500 handlers and wires up the rest of the URLs
├── media/                              Stores uploaded photos for comments and recipes
└── recipes/
    ├── admin.py                        Defines the admin pages for recipes
    ├── fixtures/
    │   └── reference.json              Defines Units, Tags, and Ingredients for the normal and bulk demos
    ├── format.py                       Provides a function to format an ingredient in a single line
    ├── management/
    │   ├── commands/
    │   │   ├── _bulk_data.py           Adjectives and nouns used to create recipe titles for the bulk demo
    │   │   ├── _demo_data.py           Data for the normal demo
    │   │   └── seed.py                 A command to seed a normal or bulk demo
    ├── models.py                       Models for recipes
    ├── permissions.py                  Helpers for checking edit and deletion capabilities
    ├── photos.py                       Functions for working with images
    └── tests/                          Tests for all recipe functionality                         
```
