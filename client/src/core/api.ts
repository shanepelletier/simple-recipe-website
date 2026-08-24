// One module owning every URL in the app. No component builds a URL string.
// This is Angular's ApiService with the class taken off: plain exported
// functions in a module already are the singleton.

import { del, get, patch, post, put } from "./client";
import type {
  Comment,
  Ingredient,
  Page,
  RatingResponse,
  Recipe,
  RecipeCard,
  ShoppingGroup,
  ShoppingItem,
  Tag,
  UnitGroup,
  User,
} from "./models";

// The next two are `type` aliases rather than interfaces, and that is not
// style. TypeScript gives an alias an implicit index signature and an
// interface none, so an interface stops assigning to the Record<string, …>
// that queryString and the client's Payload take:
//
//   error TS2345: Index signature for type 'string' is missing in type
//   'RecipeQuery'.
//
// The response shapes in models.ts stay interfaces, since nothing ever passes
// one to a Record-typed parameter. The rule: types that get *sent* are `type`,
// types that get *received* are `interface`.

export type RecipeQuery = {
  search?: string;
  // An array because the server ANDs a repeating `?tag=`: a recipe must
  // carry every tag listed. queryString emits one `tag=` per entry rather
  // than joining them, since joining would just move the parsing problem
  // onto the server.
  tag?: string[];
  author?: string;
  min_rating?: string;
  sort?: string;
  // A string because that is what useSearchParams hands you; converting at
  // both ends buys nothing, and queryString calls String() anyway.
  page?: string;
};

export type RecipeBody = {
  name: string;
  tags: number[];
  ingredients: {
    ingredient_id?: number;
    ingredient_name?: string;
    unit_id: number;
    quantity: string;
  }[];
  steps: string[];
};

/** Drops empty values, so a cleared filter leaves the URL rather than becoming "". */
function queryString(query: Record<string, string | number | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
    } else if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

// ---- auth ----
export const me = () => get<{ user: User | null }>("/api/auth/me/");

export const login = (username: string, password: string) =>
  post<{ user: User }>("/api/auth/login/", { username, password });

export const register = (username: string, password: string) =>
  post<{ user: User }>("/api/auth/register/", { username, password });

export const logout = () => post<{ user: null }>("/api/auth/logout/", {});

// ---- recipes ----
export const recipes = (query: RecipeQuery) =>
  get<Page<RecipeCard>>(`/api/recipes/${queryString(query)}`);

export const recipe = (id: number) => get<{ recipe: Recipe }>(`/api/recipes/${id}/`);

export const createRecipe = (body: RecipeBody) => post<{ recipe: Recipe }>("/api/recipes/", body);

// The server rejects a PATCH with no version, so the type demands one rather
// than leaving it to every call site to remember. That is also what keeps the
// optimistic-locking 409 reachable: a caller who could omit the version would
// get a plain 400 instead.
export const updateRecipe = (id: number, body: RecipeBody & { version: number }) =>
  patch<{ recipe: Recipe }>(`/api/recipes/${id}/`, body);

export const deleteRecipe = (id: number) => del<{ deleted: boolean }>(`/api/recipes/${id}/`);

export function uploadRecipePhoto(id: number, file: File) {
  const form = new FormData();
  form.append("photo", file);
  return post<{ photo: string }>(`/api/recipes/${id}/photo/`, form);
}

export const copyRecipe = (id: number) => post<{ recipe: Recipe }>(`/api/recipes/${id}/copy/`, {});

// ---- reviews ----
export const rate = (id: number, rating: number) =>
  put<RatingResponse>(`/api/recipes/${id}/review/`, { rating });

export const unrate = (id: number) => del<RatingResponse>(`/api/recipes/${id}/review/`);

// ---- comments ----
export const comments = (id: number, page = 1, sort: "newest" | "oldest" = "newest") =>
  get<Page<Comment>>(`/api/recipes/${id}/comments/${queryString({ page, sort })}`);

export function addComment(id: number, body: string, photo?: File | null) {
  const form = new FormData();
  form.append("body", body);
  if (photo) {
    form.append("photo", photo);
  }
  return post<{ comment: Comment }>(`/api/recipes/${id}/comments/`, form);
}

export const deleteComment = (id: number) => del<{ deleted: boolean }>(`/api/comments/${id}/`);

// ---- reference ----
export const tags = () => get<{ results: Tag[] }>("/api/tags/");

export const units = () => get<{ groups: UnitGroup[] }>("/api/units/");

export const ingredients = (q: string) =>
  get<{ results: Ingredient[] }>(`/api/ingredients/${queryString({ q })}`);

// ---- shopping list ----
export const shoppingList = () => get<{ groups: ShoppingGroup[] }>("/api/shopping-list/");

export const addShoppingItem = (ingredient_id: number, unit_id: number, quantity: string) =>
  post<{ item: ShoppingItem }>("/api/shopping-list/", { ingredient_id, unit_id, quantity });

// Answers with the whole list rather than the rows it touched — adding a
// recipe merges into existing lines, so "what changed" is the entire list.
export const addRecipeToShoppingList = (id: number) =>
  post<{ groups: ShoppingGroup[] }>(`/api/shopping-list/from-recipe/${id}/`, {});

// Same endpoint, narrowed to one row by id — the server still attributes it
// to the recipe (source_recipe), which a plain POST /api/shopping-list/ call
// couldn't do since that endpoint has no notion of a recipe at all.
export const addRecipeIngredientToShoppingList = (recipeId: number, recipeIngredientId: number) =>
  post<{ groups: ShoppingGroup[] }>(`/api/shopping-list/from-recipe/${recipeId}/`, {
    ingredient_id: recipeIngredientId,
  });

export const updateShoppingItem = (
  id: number,
  changes: { is_checked?: boolean; quantity?: string },
) => patch<{ item: ShoppingItem }>(`/api/shopping-list/${id}/`, changes);

export const deleteShoppingItem = (id: number) =>
  del<{ deleted: boolean }>(`/api/shopping-list/${id}/`);
