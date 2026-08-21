"""Demo recipe content for `manage.py seed --demo`.

Plain data, not logic — the command that consumes this resolves owners,
ingredients, and units, and creates the rows. Each recipe has a stable
`key` so other entries (a copy, a review, a comment) can reference it
explicitly instead of guessing by name, which breaks silently if a name
ever changes or repeats.
"""

# Each ingredient is (quantity, unit name, ingredient name). "photo" defaults
# to True — set it False for the couple of recipes that deliberately go
# without one, exercising the missing-photo UI state.
DEMO_RECIPES = [
    {
        "key": "chili",
        "owner": "alice",
        "name": "Classic Beef Chili",
        "ingredients": [
            ("2", "pound", "ground beef"),  # same unit as the tacos below: merges
            ("1", "whole", "onion"),
            ("3", "clove", "garlic"),
            ("4", "whole", "tomato"),
            ("1", "tablespoon", "paprika"),
            ("1", "tablespoon", "cumin"),
            ("1", "teaspoon", "salt"),
        ],
        "steps": [
            "Brown the ground beef in a large pot.",
            "Add the onion and garlic, cook until soft.",
            "Stir in the tomatoes, paprika, cumin, and salt.",
            "Simmer uncovered for one hour.",
        ],
        "tags": ["spicy"],
    },
    {
        "key": "tacos",
        "owner": "alice",
        "name": "Weeknight Beef Tacos",
        "ingredients": [
            ("1", "pound", "ground beef"),  # same unit as the chili above: merges
            ("1", "whole", "onion"),
            ("0.5", "cup", "cheddar cheese"),
            ("1", "whole", "tomato"),
            ("1", "whole", "lime"),
        ],
        "steps": [
            "Brown the ground beef with the onion.",
            "Warm the tortillas.",
            "Assemble with cheese, tomato, and a squeeze of lime.",
        ],
        "tags": ["quick"],
        "photo": False,
    },
    {
        "key": "pasta",
        "owner": "alice",
        "name": "Garlic Butter Pasta",
        "ingredients": [
            ("1", "pound", "pasta"),
            ("4", "tablespoon", "butter"),
            ("4", "clove", "garlic"),
            ("0.5", "cup", "parmesan cheese"),
            ("1", "teaspoon", "black pepper"),
        ],
        "steps": [
            "Cook the pasta according to package directions.",
            "Melt the butter and cook the garlic until fragrant.",
            "Toss the pasta with the garlic butter and parmesan.",
            "Finish with black pepper.",
        ],
        "tags": ["quick", "vegetarian"],
    },
    {
        "key": "pasta_copy",
        "owner": "bob",
        "name": "Garlic Butter Pasta",
        "ingredients": [
            ("1", "pound", "pasta"),
            ("4", "tablespoon", "butter"),
            ("4", "clove", "garlic"),
            ("0.5", "cup", "parmesan cheese"),
            ("1", "teaspoon", "black pepper"),
        ],
        "steps": [
            "Cook the pasta according to package directions.",
            "Melt the butter and cook the garlic until fragrant.",
            "Toss the pasta with the garlic butter and parmesan.",
            "Finish with black pepper.",
        ],
        "tags": ["quick", "vegetarian"],
        "copied_from": "pasta",
        "copied_from_username": "alice",
    },
    {
        "key": "lemon_chicken",
        "owner": "alice",
        "name": "Lemon Herb Roast Chicken",
        "ingredients": [
            ("2", "pound", "chicken breast"),
            ("2", "whole", "lemon"),
            ("4", "clove", "garlic"),
            ("2", "tablespoon", "olive oil"),
            ("1", "teaspoon", "salt"),
            ("1", "teaspoon", "black pepper"),
        ],
        "steps": [
            "Rub the chicken with olive oil, salt, and pepper.",
            "Tuck the garlic and lemon halves around the chicken.",
            "Roast until the internal temperature reaches 165°F.",
        ],
        "tags": ["gluten-free"],
    },
    {
        "key": "beef_rice_bowl",
        "owner": "bob",
        "name": "Beef and Rice Bowl",
        "ingredients": [
            ("1", "cup", "ground beef"),  # different unit from the chili/tacos: separate row
            ("2", "cup", "rice"),
            ("2", "tablespoon", "soy sauce"),
            ("2", "clove", "garlic"),
            ("1", "whole", "onion"),
        ],
        "steps": [
            "Cook the rice.",
            "Brown the ground beef with the garlic and onion.",
            "Stir in the soy sauce and serve over rice.",
        ],
        "tags": ["quick"],
    },
    {
        "key": "tomato_soup",
        "owner": "bob",
        "name": "Vegan Tomato Basil Soup",
        "ingredients": [
            ("6", "whole", "tomato"),
            ("2", "tablespoon", "olive oil"),
            ("2", "clove", "garlic"),
            ("1", "whole", "onion"),
            ("0.25", "cup", "basil"),
            ("1", "teaspoon", "salt"),
        ],
        "steps": [
            "Sauté the onion and garlic in olive oil.",
            "Add the tomatoes and salt, simmer for 20 minutes.",
            "Blend until smooth and stir in the basil.",
        ],
        "tags": ["vegan", "vegetarian", "gluten-free"],
        "photo": False,
    },
    {
        "key": "breakfast_skillet",
        "owner": "bob",
        "name": "Bacon and Egg Breakfast Skillet",
        "ingredients": [
            ("6", "slice", "bacon"),
            ("4", "whole", "egg"),
            ("2", "whole", "potato"),
            ("0.5", "cup", "cheddar cheese"),
            ("1", "teaspoon", "black pepper"),
        ],
        "steps": [
            "Cook the bacon until crisp, then set aside.",
            "Cook the diced potato in the bacon fat until golden.",
            "Crack in the eggs and top with cheese and bacon.",
        ],
        "tags": ["breakfast"],
    },
    {
        "key": "pancakes",
        "owner": "alice",
        "name": "Classic Pancakes",
        "ingredients": [
            ("2", "cup", "flour"),
            ("1.5", "cup", "milk"),
            ("2", "whole", "egg"),
            ("2", "tablespoon", "sugar"),
            ("1", "tablespoon", "baking powder"),
            ("2", "tablespoon", "butter"),
            ("1", "teaspoon", "vanilla extract"),
        ],
        "steps": [
            "Whisk the dry ingredients together.",
            "Whisk in the milk, eggs, melted butter, and vanilla.",
            "Cook spoonfuls on a hot griddle until bubbles form, then flip.",
        ],
        "tags": ["breakfast", "quick"],
    },
]

# Reviews as (recipe key, reviewer username, rating). Several reviewers on
# one recipe, with ratings that aren't all 5, per the demo requirements.
DEMO_REVIEWS = [
    ("chili", "bob", 4),
    ("chili", "moderator", 5),
    ("chili", "admin", 3),
    ("lemon_chicken", "bob", 5),
    ("lemon_chicken", "moderator", 4),
]

# A deliberate mix of comments with and without a photo attached.
DEMO_COMMENTS = [
    {
        "recipe": "chili",
        "author": "bob",
        "body": "Made this last night, the spice level is perfect.",
        "photo": True,
    },
    {
        "recipe": "chili",
        "author": "moderator",
        "body": "Great weeknight dinner, will make again.",
        "photo": False,
    },
    {
        "recipe": "lemon_chicken",
        "author": "bob",
        "body": "Came out juicy every time I've made it.",
        "photo": False,
    },
]
