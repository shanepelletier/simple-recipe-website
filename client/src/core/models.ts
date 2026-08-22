// One interface per JSON shape `server/config/api/serializers.py` returns.
// Same field names, same nullability. Response *envelopes* ({ recipe: … },
// { results: … }) are not here — they are inline generics in api.ts, since
// each one belongs to exactly one endpoint.

export interface User {
  id: number;
  username: string;
  is_staff: boolean;
  is_moderator: boolean;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Unit {
  id: number;
  name: string;
  plural: string;
  abbreviation: string;
  category: "mass" | "volume" | "count";
  takes_of: boolean;
}

export interface UnitGroup {
  category: string;
  label: string;
  units: Unit[];
}

export interface Ingredient {
  id: number;
  name: string;
  plural: string;
}

export interface RecipeIngredient {
  id: number;
  ingredient: Ingredient;
  unit: Unit;

  // A string on purpose: the server sends decimals as strings so no value
  // drifts through a float round-trip. Keep it a string all the way to the
  // input element, and never parseFloat one to send it back.
  quantity: string;

  // Pre-formatted by the server ("2 pounds of beef"). Anything user-facing
  // renders this rather than assembling quantity + unit + ingredient itself,
  // so the client and the shopping list can't disagree about plurals.
  display: string;

  position: number;
}

export interface Step {
  id: number;
  text: string;
  position: number;
}

export interface RecipeCard {
  id: number;
  name: string;
  photo: string | null;

  // null means "no reviews yet", which is not a rating of 0 and must not
  // render as one — `{recipe.rating && …}` would print a bare 0.
  rating: number | null;

  rating_count: number;
  tags: Tag[];
  owner: string;
  created_at: string;
}

export interface Recipe extends RecipeCard {
  ingredients: RecipeIngredient[];
  steps: Step[];
  version: number;
  copied_from_id: number | null;
  copied_from_username: string;
  updated_at: string;
  can_edit: boolean;

  // The same "null is not zero" rule as `rating`, about you personally:
  // null means you haven't rated this, so the stars start empty.
  user_rating: number | null;
}

// Note this shadows the DOM's own `Comment` — always import it explicitly, or
// a file silently type-checks against a comment *node* and fails later with a
// message about `nodeValue`. Left matching the API's vocabulary on purpose.
export interface Comment {
  id: number;
  body: string;
  photo: string | null;
  author: string;
  created_at: string;
  can_delete: boolean;
}

export interface ShoppingItem {
  id: number;
  ingredient: Ingredient;
  unit: Unit;
  quantity: string; // a string for the same reason as RecipeIngredient's
  display: string;
  is_checked: boolean;
  source_recipe_id: number | null;
}

export interface ShoppingGroup {
  ingredient: string;
  items: ShoppingItem[];
}

/** What PUT and DELETE /api/recipes/<id>/review/ both return. */
export interface RatingResponse {
  rating: number | null;
  recipe: { id: number; rating: number | null; rating_count: number };
}

export interface Page<T> {
  results: T[];
  page: number;
  pages: number;
  total: number;
}

/** The envelope every API error uses: {"error": "…", "fields": {…}}. */
export interface ApiErrorBody {
  error: string;
  fields: Record<string, string[]>;
}
