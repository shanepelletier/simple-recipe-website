from django.urls import path

from .views import auth, recipes

app_name = "api"

urlpatterns = [
    path("auth/register/", auth.register, name="register"),
    path("auth/login/", auth.log_in, name="login"),
    path("auth/logout/", auth.log_out, name="logout"),
    path("auth/me/", auth.me, name="me"),
    path("recipes/", recipes.recipe_collection, name="recipe-list"),
    path("recipes/<int:pk>/", recipes.recipe_resource, name="recipe-detail"),
    path("recipes/<int:pk>/photo/", recipes.recipe_photo, name="recipe-photo"),
]
