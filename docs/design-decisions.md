# Design decisions

These are decisions that were made regarding how the application should look and behave to the end-user. These decisions were made either by myself (for minor decisions) or collaboratively.

- Recipe search is case insensitive.
- Searching for multiple tags is supported using a token field, and means "find all recipes with tag X and with tag Y", so a user can find "vegan" and "quick" recipes easily. Adding an option to also search with OR might make sense in the future.
- Quantities are only ever decimals, not fractions. This isn't the greatest UX and should be improved in the future so actual fractions exist and add together properly.
- Tags are chosen from a list of pre-created tags, which admins can modify using the standard Django admin interface.
- Tags have a maximum length of 30 characters.
- Tags are displayed in alphabetical order.
- Recipe ingredients are structured: they have a quantity, measurement, and ingredient. Quantities are decimal numbers with up to 10 digits and 3 decimal place; units have a category (currently mass, volume, or count), name (up to 30 characters), plural (also up to 30 characters), and an abbreviation which is currently unused; ingredient is the actual name of the ingredient (up to 100 characters).
- There is no maximum number of steps for a recipe, or for ingredients.
- The maximum length of a comment is 250 words (defined as any group of 1 or more characters separated by whitespace) or 3000 characters (to prevent the case where an attacker leaves a comment that is 3 billion characters long but all one "word").
- Ingredients from recipes can be added all at once to the shopping list, or one at a time.
