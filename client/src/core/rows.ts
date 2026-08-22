import type { RecipeBody } from "./api";
import type { Recipe } from "./models";

/**
 * One editable ingredient row in a form.
 *
 * `ingredientName` is always what the box displays. `ingredientId` is set only
 * when that name came from picking an existing ingredient rather than typing a
 * new one, and which of the two the request carries is decided at send time —
 * an id when one is known, a name when the ingredient is being created inline,
 * which is the shape the server's ingredient resolution expects.
 *
 * Field names are the client's own rather than the API's, because this is a
 * form's state and not a payload. The single place they become snake_case is
 * `toRecipeBody`, which is also the only place a row has to be complete.
 */
export interface QuantityValue {
  quantity: string;
  unitId: number | null;
  ingredientId: number | null;
  ingredientName: string;
}

export const emptyQuantity = (): QuantityValue => ({
  quantity: "",
  unitId: null,
  ingredientId: null,
  ingredientName: "",
});

/**
 * `key` is React's key, and it is not the array index.
 *
 * Angular's FormArray kept control objects that carried identity through a
 * reorder. React keys by whatever it is told to key by, so identity has to be
 * explicit: key by index instead and React reuses the DOM node at position 2
 * for whatever row is now at position 2, so deleting the first of three rows
 * leaves the inputs showing the previous row's text. It looks exactly like a
 * state bug and is not.
 */
export interface IngredientRow extends QuantityValue {
  key: number;
}

export interface StepRow {
  key: number;
  text: string;
}

let nextKey = 0;
export const newKey = () => nextKey++;

export const blankIngredient = (): IngredientRow => ({ key: newKey(), ...emptyQuantity() });

export const blankStep = (): StepRow => ({ key: newKey(), text: "" });

export function updateRow<T extends { key: number }>(rows: T[], key: number, changes: Partial<T>) {
  return rows.map((row) => (row.key === key ? { ...row, ...changes } : row));
}

export function removeRow<T extends { key: number }>(rows: T[], key: number): T[] {
  return rows.filter((row) => row.key !== key);
}

export function moveRow<T>(rows: T[], from: number, to: number): T[] {
  if (to < 0 || to >= rows.length) {
    // The same reference, so React skips the re-render entirely. Returning a
    // new array of identical contents would re-render every row on every
    // rejected move-up of the first one.
    return rows;
  }
  // A copy, always: splicing the state array would mutate the object React is
  // holding, and the re-render simply would not happen.
  const next = [...rows];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

/** A row that has everything the server needs — see `completeIngredients`. */
type CompleteRow = IngredientRow & { unitId: number };

/**
 * The rows, if every one of them is ready to send; otherwise null.
 *
 * This exists so `toRecipeBody` can require complete rows in its signature
 * rather than reaching for `unitId!` or a placeholder id. A row with no unit
 * is a form that is not finished, and it should be reported as such — not sent
 * as an id the server will fail to look up and describe as an unknown unit.
 */
export function completeIngredients(rows: IngredientRow[]): CompleteRow[] | null {
  const ready = rows.filter(
    (row): row is CompleteRow =>
      row.unitId !== null && row.quantity.trim() !== "" && row.ingredientName.trim() !== "",
  );
  return ready.length === rows.length && rows.length > 0 ? ready : null;
}

/** The array's order becomes `position` on the server, so nothing sends one. */
export function toRecipeBody(
  name: string,
  tags: number[],
  ingredients: CompleteRow[],
  steps: StepRow[],
): RecipeBody {
  return {
    name,
    tags,
    ingredients: ingredients.map((row) => ({
      // Only ever one of the two: an id wins, a typed name creates. Sending
      // both is ambiguous, and the server would be within its rights to
      // resolve it either way.
      ...(row.ingredientId === null
        ? { ingredient_name: row.ingredientName }
        : { ingredient_id: row.ingredientId }),
      unit_id: row.unitId,
      quantity: row.quantity,
    })),
    steps: steps.map((row) => row.text),
  };
}

export const rowsFromRecipe = (recipe: Recipe): IngredientRow[] =>
  recipe.ingredients.map((row) => ({
    key: newKey(),
    ingredientId: row.ingredient.id,
    ingredientName: row.ingredient.name,
    unitId: row.unit.id,
    quantity: row.quantity,
  }));

export const stepsFromRecipe = (recipe: Recipe): StepRow[] =>
  recipe.steps.map((step) => ({ key: newKey(), text: step.text }));
