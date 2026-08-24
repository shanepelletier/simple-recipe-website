from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator, MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models.signals import post_delete

from .format import format_ingredient
from .photos import delete_photo_file, upload_to, validate_image

MAX_COMMENT_WORDS = 250


class Unit(models.Model):
    """A measurement, e.g. pound / cup / whole.

    `category` only groups the picker in the UI. Nothing converts between
    units.
    """

    class Category(models.TextChoices):
        MASS = "mass", "Mass"
        VOLUME = "volume", "Volume"
        COUNT = "count", "Count"

    name = models.CharField(max_length=30, unique=True)  # "pound"
    plural = models.CharField(max_length=30)  # "pounds"
    abbreviation = models.CharField(max_length=10, blank=True)
    category = models.CharField(max_length=10, choices=Category.choices)
    takes_of = models.BooleanField(
        default=True,
        help_text='True renders "2 pounds of beef", False renders "3 whole oranges".',
    )

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return self.name


class Tag(models.Model):
    """Created by admins only, via the Django admin."""

    name = models.CharField(max_length=30, unique=True)

    class Meta:
        ordering = ["name"]  # global consistent order, per the clarification

    def __str__(self):
        return self.name


class Ingredient(models.Model):
    name = models.CharField(max_length=100)  # "orange"
    plural = models.CharField(max_length=100)  # "oranges"
    normalized_name = models.CharField(max_length=100, unique=True, db_index=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.normalized_name = self.normalize(self.name)
        super().save(*args, **kwargs)

    @staticmethod
    def normalize(name: str) -> str:
        """Lowercase, collapse whitespace, strip punctuation.

        Catches "Tomato" vs " tomato ". Does NOT catch "tomato" vs
        "tomatoes" — that needs a stemmer, so admins merge those by hand.
        """
        cleaned = "".join(c for c in name.lower() if c.isalnum() or c.isspace())
        return " ".join(cleaned.split())


class Recipe(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recipes"
    )
    name = models.CharField(max_length=200)
    photo = models.ImageField(
        upload_to=upload_to, null=True, blank=True, validators=[validate_image]
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="recipes")

    # Denormalized so the grid can sort by rating without a GROUP BY.
    rating_sum = models.PositiveIntegerField(default=0)
    rating_count = models.PositiveIntegerField(default=0)

    # Optimistic locking. Bumped on every write; stale writes get a 409.
    version = models.PositiveIntegerField(default=1)

    copied_from = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="copies"
    )
    # Kept separately so attribution survives the original being deleted.
    copied_from_username = models.CharField(max_length=150, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["name"]),
            models.Index(fields=["owner"]),
        ]
        permissions = [
            ("moderate_recipe", "Can edit and delete any recipe"),
            ("moderate_tag", "Can manage tags"),
            ("moderate_ingredient", "Can manage ingredients"),
            ("moderate_comment", "Can delete any comment"),
        ]

    def __str__(self):
        return self.name

    @property
    def rating_average(self):
        if not self.rating_count:
            return None
        return round(self.rating_sum / self.rating_count, 2)

    def clean(self):
        # M2M isn't available until the row exists, so only check saved rows.
        if self.pk and self.tags.count() > settings.MAX_TAGS_PER_RECIPE:
            raise ValidationError(
                {"tags": f"A recipe can have at most {settings.MAX_TAGS_PER_RECIPE} tags."}
            )


post_delete.connect(delete_photo_file, sender=Recipe)


class RecipeIngredient(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="ingredients")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    position = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="recipe_ingredient_quantity_positive"
            ),
        ]

    def __str__(self):
        return format_ingredient(self.quantity, self.unit, self.ingredient)


class Step(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="steps")
    text = models.TextField()
    position = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["position"]

    def __str__(self):
        return f"{self.recipe.name} step {self.position}"


class Review(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # The DB constraint is what actually enforces one-review-per-user.
            # A read-then-write check in the view would not survive two
            # simultaneous requests.
            models.UniqueConstraint(fields=["recipe", "user"], name="one_review_per_user"),
            models.CheckConstraint(
                condition=models.Q(rating__gte=1) & models.Q(rating__lte=5),
                name="rating_between_1_and_5",
            ),
        ]

    def __str__(self):
        return f"{self.user} rated {self.recipe.name} {self.rating}"


class Comment(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    # TextField.max_length only feeds a ModelForm's widget — it is NOT
    # enforced by full_clean() the way CharField's max_length is (CharField
    # appends a MaxLengthValidator in __init__; TextField does not). This
    # project never goes through a ModelForm, so the explicit validator
    # below is what actually makes the 3000-character cap real.
    body = models.TextField(max_length=3000, validators=[MaxLengthValidator(3000)])
    photo = models.ImageField(
        upload_to=upload_to, null=True, blank=True, validators=[validate_image]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipe", "-created_at"])]

    def __str__(self):
        return f"{self.author} on {self.recipe.name}"

    def clean(self):
        if len(self.body.split()) > MAX_COMMENT_WORDS:
            raise ValidationError({"body": f"Comments can be at most {MAX_COMMENT_WORDS} words."})


post_delete.connect(delete_photo_file, sender=Comment)


class ShoppingItem(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shopping_items"
    )
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    is_checked = models.BooleanField(default=False)
    # SET_NULL: deleting a recipe must not remove items you still need to buy.
    source_recipe = models.ForeignKey(Recipe, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["ingredient__name", "unit__name"]
        constraints = [
            # Entries combine only on an exact ingredient+unit match.
            # "1 pound of beef" and "1 cup of beef" are two rows, on purpose.
            models.UniqueConstraint(
                fields=["user", "ingredient", "unit"], name="one_row_per_user_ingredient_unit"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="shopping_quantity_positive"
            ),
        ]

    def __str__(self):
        return format_ingredient(self.quantity, self.unit, self.ingredient)
