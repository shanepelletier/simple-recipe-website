from django.urls import path

from .views import auth, comments, recipes, reviews

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
]
