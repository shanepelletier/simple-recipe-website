import { describe, expect, it } from "vitest";

import {
  blankIngredient,
  completeIngredients,
  moveRow,
  removeRow,
  toRecipeBody,
  updateRow,
} from "./rows";
import type { IngredientRow } from "./rows";

const row = (changes: Partial<IngredientRow> = {}): IngredientRow => ({
  ...blankIngredient(),
  unitId: 1,
  quantity: "2",
  ingredientName: "beef",
  ...changes,
});

const complete = (rows: IngredientRow[]) => completeIngredients(rows) ?? [];

describe("moveRow", () => {
  it("moves a row up without disturbing the others", () => {
    const [a, b, c] = [row(), row(), row()];

    expect(moveRow([a, b, c], 1, 0)).toEqual([b, a, c]);
  });

  it("moves a row down", () => {
    const [a, b, c] = [row(), row(), row()];

    expect(moveRow([a, b, c], 0, 2)).toEqual([b, c, a]);
  });

  it("is a no-op past either end, and returns the same array", () => {
    // The same reference, not a copy: a new array of identical contents would
    // re-render every row each time the first row's move-up is rejected.
    const rows = [row(), row()];

    expect(moveRow(rows, 0, -1)).toBe(rows);
    expect(moveRow(rows, 1, 2)).toBe(rows);
  });

  it("never mutates the array it was given", () => {
    // The React one. Splicing the state array in place mutates the object
    // React is holding, so the data changes and the screen does not.
    const [a, b] = [row(), row()];
    const rows = [a, b];

    moveRow(rows, 0, 1);

    expect(rows).toEqual([a, b]);
  });
});

describe("updateRow and removeRow", () => {
  it("updates only the row with the matching key", () => {
    const [a, b] = [row(), row()];

    const result = updateRow([a, b], b.key, { quantity: "9" });

    expect(result[0].quantity).toBe("2");
    expect(result[1].quantity).toBe("9");
  });

  it("removes by key, not by position", () => {
    const [a, b, c] = [row(), row(), row()];

    expect(removeRow([a, b, c], b.key)).toEqual([a, c]);
  });
});

describe("completeIngredients", () => {
  it("accepts rows that have all three parts", () => {
    expect(completeIngredients([row(), row()])).toHaveLength(2);
  });

  it("rejects the whole set when any row is missing its unit", () => {
    // Rejecting rather than dropping the row: a silently discarded ingredient
    // is worse than a form that says which line is unfinished.
    expect(completeIngredients([row(), row({ unitId: null })])).toBeNull();
  });

  it("rejects a row with no quantity or no ingredient", () => {
    expect(completeIngredients([row({ quantity: "  " })])).toBeNull();
    expect(completeIngredients([row({ ingredientName: "" })])).toBeNull();
  });

  it("rejects an empty form, since a recipe needs at least one ingredient", () => {
    expect(completeIngredients([])).toBeNull();
  });
});

describe("toRecipeBody", () => {
  it("sends ingredient_id for a picked ingredient and no name", () => {
    const rows = complete([row({ ingredientId: 4, ingredientName: "beef" })]);

    const body = toRecipeBody("Chili", [], rows, []);

    expect(body.ingredients[0].ingredient_id).toBe(4);
    expect(body.ingredients[0].ingredient_name).toBeUndefined();
  });

  it("sends ingredient_name for a newly typed one and no id", () => {
    const rows = complete([row({ ingredientName: "okra" })]);

    const body = toRecipeBody("Chili", [], rows, []);

    expect(body.ingredients[0].ingredient_id).toBeUndefined();
    expect(body.ingredients[0].ingredient_name).toBe("okra");
  });

  it("preserves row order, which becomes position on the server", () => {
    const rows = complete([row({ quantity: "1" }), row({ quantity: "2" }), row({ quantity: "3" })]);

    const body = toRecipeBody("Chili", [], rows, []);

    expect(body.ingredients.map((i) => i.quantity)).toEqual(["1", "2", "3"]);
  });

  it("sends steps as plain strings in order, with no position field", () => {
    const body = toRecipeBody("Chili", [], complete([row()]), [
      { key: 1, text: "Brown the beef" },
      { key: 2, text: "Add the onion" },
    ]);

    expect(body.steps).toEqual(["Brown the beef", "Add the onion"]);
  });
});
