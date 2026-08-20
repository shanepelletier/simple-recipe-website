from django.db import models


class Unit(models.Model):
    """A measurement, e.g. pound / cup / whole.

    `category` only groups the picker in the UI. Nothing converts between
    units — see PLAN.md.
    """

    class Category(models.TextChoices):
        MASS = "mass", "Mass"
        VOLUME = "volume", "Volume"
        COUNT = "count", "Count"

    name = models.CharField(max_length=30, unique=True)      # "pound"
    plural = models.CharField(max_length=30)                 # "pounds"
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


class Ingredient(models.Model):
    name = models.CharField(max_length=100)                  # "orange"
    plural = models.CharField(max_length=100)                # "oranges"
    normalized_name = models.CharField(max_length=100, unique=True, db_index=True)

    class Meta:
        ordering = ["name"]

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

    def __str__(self):
        return self.name
