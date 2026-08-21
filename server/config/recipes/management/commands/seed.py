from decimal import Decimal
from io import BytesIO
from uuid import uuid4

from accounts.models import User
from django.contrib.auth.models import Group, Permission
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from PIL import Image, ImageDraw

from recipes.models import Comment, Ingredient, Recipe, RecipeIngredient, Review, Step, Tag, Unit

from ._demo_data import DEMO_COMMENTS, DEMO_RECIPES, DEMO_REVIEWS

DEMO_PASSWORD = "demo-password-123"

# Cycled by index so every recipe gets a distinct-ish placeholder colour.
PHOTO_COLOURS = [
    (196, 90, 60),
    (60, 130, 110),
    (70, 100, 170),
    (180, 140, 50),
    (140, 70, 150),
]
COMMENT_PHOTO_COLOUR = (90, 90, 90)


def make_image(text: str, colour: tuple[int, int, int]) -> ContentFile:
    image = Image.new("RGB", (800, 600), colour)
    ImageDraw.Draw(image).text((40, 280), text, fill=(255, 255, 255))
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=80)
    return ContentFile(buffer.getvalue(), name=f"{uuid4().hex}.jpg")


class Command(BaseCommand):
    help = "Seed the database with demo or bulk data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--demo", action="store_true", help="Small, readable dataset with known logins."
        )
        parser.add_argument("--users", type=int, default=0)
        parser.add_argument("--recipes", type=int, default=0)
        parser.add_argument(
            "--seed", type=int, default=42, help="Random seed, so runs are reproducible."
        )
        parser.add_argument(
            "--flush", action="store_true", help="Delete existing recipe data first."
        )

    def handle(self, *args, **options):
        with transaction.atomic():
            if options["flush"]:
                self._flush()

            if options["demo"]:
                self._seed_demo()
            elif options["users"] or options["recipes"]:
                raise CommandError("Bulk mode isn't implemented yet.")
            else:
                raise CommandError("Pass --demo, or --users/--recipes for bulk mode.")

    def _flush(self):
        self.stdout.write("Flushing existing recipe data...")
        # Cascades away RecipeIngredient, Step, Review, Comment, and the tags M2M.
        Recipe.objects.all().delete()
        # Ingredient/Unit are PROTECTed by RecipeIngredient, so this only
        # works once the recipes referencing them are gone (just above).
        Ingredient.objects.all().delete()
        Unit.objects.all().delete()
        Tag.objects.all().delete()

    def _seed_demo(self):
        self.stdout.write("Loading reference data...")
        call_command("loaddata", "reference")

        authors, moderators = self._seed_groups()
        users = self._seed_users(authors, moderators)

        units = Unit.objects.in_bulk(field_name="name")
        # Ingredient.name isn't a unique field (only normalized_name is), so
        # in_bulk can't use it directly — the reference fixture's names are
        # unique in practice, so a plain dict comprehension is safe here.
        ingredients = {ingredient.name: ingredient for ingredient in Ingredient.objects.all()}

        recipes = self._seed_recipes(users, units, ingredients)
        self._seed_reviews(users, recipes)
        self._seed_comments(users, recipes)

        self.stdout.write(self.style.SUCCESS("\nDemo data ready. Known logins:"))
        for username in ("admin", "moderator", "alice", "bob"):
            self.stdout.write(f"  {username} / {DEMO_PASSWORD}")

    def _seed_groups(self):
        authors, _ = Group.objects.get_or_create(name="Authors")
        moderators, _ = Group.objects.get_or_create(name="Moderators")
        moderate_perms = Permission.objects.filter(
            content_type__app_label="recipes",
            codename__in=[
                "moderate_recipe",
                "moderate_tag",
                "moderate_ingredient",
                "moderate_comment",
            ],
        )
        moderators.permissions.set(moderate_perms)
        return authors, moderators

    def _seed_users(self, authors, moderators):
        def make_user(username, *, is_staff=False, is_superuser=False, group=None):
            user, _ = User.objects.get_or_create(username=username)
            user.is_staff = is_staff
            user.is_superuser = is_superuser
            user.set_password(DEMO_PASSWORD)
            user.save()
            if group is not None:
                user.groups.add(group)
            return user

        return {
            "admin": make_user("admin", is_staff=True, is_superuser=True),
            "moderator": make_user("moderator", group=moderators),
            "alice": make_user("alice", group=authors),
            "bob": make_user("bob", group=authors),
        }

    def _seed_recipes(self, users, units, ingredients):
        by_key = {}
        for position, spec in enumerate(DEMO_RECIPES):
            photo = ""
            if spec.get("photo", True):
                photo = make_image(spec["name"], PHOTO_COLOURS[position % len(PHOTO_COLOURS)])
            recipe = Recipe.objects.create(
                owner=users[spec["owner"]],
                name=spec["name"],
                copied_from_username=spec.get("copied_from_username", ""),
                photo=photo,
            )
            recipe.tags.set(Tag.objects.filter(name__in=spec["tags"]))
            RecipeIngredient.objects.bulk_create(
                RecipeIngredient(
                    recipe=recipe,
                    ingredient=ingredients[ingredient_name],
                    unit=units[unit_name],
                    quantity=Decimal(quantity),
                    position=position,
                )
                for position, (quantity, unit_name, ingredient_name) in enumerate(
                    spec["ingredients"]
                )
            )
            Step.objects.bulk_create(
                Step(recipe=recipe, text=text, position=position)
                for position, text in enumerate(spec["steps"])
            )
            by_key[spec["key"]] = recipe

        # A second pass, since a copy's source needs to already exist.
        for spec in DEMO_RECIPES:
            copied_from_key = spec.get("copied_from")
            if copied_from_key:
                recipe = by_key[spec["key"]]
                recipe.copied_from = by_key[copied_from_key]
                recipe.save(update_fields=["copied_from"])

        return by_key

    def _seed_reviews(self, users, recipes):
        Review.objects.bulk_create(
            Review(recipe=recipes[key], user=users[username], rating=rating)
            for key, username, rating in DEMO_REVIEWS
        )
        for recipe in {recipes[key] for key, _, _ in DEMO_REVIEWS}:
            ratings = list(recipe.reviews.values_list("rating", flat=True))
            recipe.rating_sum = sum(ratings)
            recipe.rating_count = len(ratings)
            recipe.save(update_fields=["rating_sum", "rating_count"])

    def _seed_comments(self, users, recipes):
        for spec in DEMO_COMMENTS:
            photo = ""
            if spec["photo"]:
                photo = make_image(f"{spec['author']}'s photo", COMMENT_PHOTO_COLOUR)
            Comment.objects.create(
                recipe=recipes[spec["recipe"]],
                author=users[spec["author"]],
                body=spec["body"],
                photo=photo,
            )
