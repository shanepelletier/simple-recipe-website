# Design decisions

These are decisions that were made regarding how the application should look and behave to the end-user. These decisions were made either by myself (for minor decisions) or collaboratively.

- Recipe search is case insensitive.
- Searching for multiple tags is supported, and means "find all recipes with tag X and with tag Y", so a user can find "vegan" and "quick" recipes easily. Adding an option to also search with OR might make sense in the future.
- Quantities are only ever decimals, not fractions. This isn't the greatest UX and should be improved in the future so actual fractions exist and add together properly.
