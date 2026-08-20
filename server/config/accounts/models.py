from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Custom user model.

    Empty today, but swapping Django's user model later requires a manual
    migration dance, so it costs nothing now and a lot later.
    """

    pass
