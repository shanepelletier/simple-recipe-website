/**
 * One editable ingredient row in a form.
 *
 * `ingredientName` is always what the box displays. `ingredientId` is set only
 * when that name came from picking an existing ingredient rather than typing a
 * new one, and which of the two the request carries is decided at send time —
 * an id when one is known, a name when the ingredient is being created inline,
 * which is the shape the server's ingredient resolution expects.
 *
 * Every field is nullable or empty here because a half-filled row is a normal
 * state for a form to be in. Turning one into a request body is deliberately
 * not this file's job: that conversion is only valid once a row is complete,
 * so it lives with the validation that establishes that, rather than inventing
 * a placeholder id for a unit nobody picked.
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
