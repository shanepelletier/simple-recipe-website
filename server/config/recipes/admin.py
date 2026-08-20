from django.contrib import admin

from .models import Comment, Ingredient, Recipe, RecipeIngredient, Review, Step, Tag, Unit


class RecipeIngredientInline(admin.TabularInline):
    model = RecipeIngredient
    extra = 1


class StepInline(admin.TabularInline):
    model = Step
    extra = 1


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "rating_average", "created_at"]
    list_filter = ["tags", "created_at"]
    search_fields = ["name", "owner__username"]
    # Without this the recipe list issues one query per row for the owner.
    list_select_related = ["owner"]
    autocomplete_fields = ["tags", "copied_from"]
    inlines = [RecipeIngredientInline, StepInline]


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ["name", "plural"]
    search_fields = ["name", "normalized_name"]


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    search_fields = ["name"]


admin.site.register([Unit, Review, Comment])
