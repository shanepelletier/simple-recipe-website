from django.urls import path

from .views import auth, comments, recipes, reference, reviews, shopping

app_name = "api"

urlpatterns = [
    path("auth/register/", auth.register, name="register"),
    path("auth/login/", auth.log_in, name="login"),
    path("auth/logout/", auth.log_out, name="logout"),
    path("auth/me/", auth.me, name="me"),
    path("recipes/", recipes.recipe_collection, name="recipe-list"),
    path("recipes/<int:pk>/", recipes.recipe_resource, name="recipe-detail"),
    path("recipes/<int:pk>/photo/", recipes.recipe_photo, name="recipe-photo"),
    path("recipes/<int:pk>/copy/", recipes.recipe_copy, name="recipe-copy"),
    path("recipes/<int:pk>/review/", reviews.review_resource, name="recipe-review"),
    path("recipes/<int:pk>/comments/", comments.comment_collection, name="recipe-comments"),
    path("comments/<int:pk>/", comments.comment_delete, name="comment-detail"),
    path("tags/", reference.tag_list, name="tag-list"),
    path("units/", reference.unit_list, name="unit-list"),
    path("ingredients/", reference.ingredient_list, name="ingredient-list"),
    path("shopping-list/", shopping.shopping_collection, name="shopping-list"),
    path(
        "shopping-list/from-recipe/<int:pk>/",
        shopping.shopping_add_from_recipe,
        name="shopping-from-recipe",
    ),
    path("shopping-list/<int:pk>/", shopping.shopping_resource, name="shopping-item"),
]
