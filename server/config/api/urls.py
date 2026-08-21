from django.urls import path

from .views import auth

app_name = "api"

urlpatterns = [
    path("auth/register/", auth.register, name="register"),
    path("auth/login/", auth.log_in, name="login"),
    path("auth/logout/", auth.log_out, name="logout"),
    path("auth/me/", auth.me, name="me"),
]
