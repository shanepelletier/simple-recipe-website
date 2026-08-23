import { describe, expect, it } from "vitest";

import type { ShoppingGroup, ShoppingItem } from "./models";
import { dropItem, replaceItem } from "./shopping";

const item = (id: number, display: string): ShoppingItem => ({
  id,
  ingredient: { id: 1, name: "ground beef", plural: "ground beef" },
  unit: {
    id: 1,
    name: "pound",
    plural: "pounds",
    abbreviation: "lb",
    category: "mass",
    takes_of: true,
  },
  quantity: "1",
  display,
  is_checked: false,
  source_recipe_id: null,
});

const groups = (): ShoppingGroup[] => [
  {
    ingredient: "ground beef",
    items: [item(1, "3 pounds of ground beef"), item(2, "1 cup of ground beef")],
  },
  { ingredient: "onion", items: [item(3, "2 whole onion")] },
];

describe("replaceItem", () => {
  it("swaps the item the server answered with, and nothing else", () => {
    const result = replaceItem(groups(), { ...item(2, "1 cup of ground beef"), is_checked: true });

    expect(result[0].items.map((row) => row.is_checked)).toEqual([false, true]);
    expect(result[1].items[0].is_checked).toBe(false);
  });

  it("leaves the item where it was", () => {
    // Checking something off must not move it. Sorting checked lines to the
    // bottom would reorder the list under the finger that just tapped it.
    const result = replaceItem(groups(), {
      ...item(1, "3 pounds of ground beef"),
      is_checked: true,
    });

    expect(result[0].items.map((row) => row.id)).toEqual([1, 2]);
  });
});

describe("dropItem", () => {
  it("removes one line and keeps the rest of its group", () => {
    const result = dropItem(groups(), 1);

    expect(result[0].items.map((row) => row.id)).toEqual([2]);
    expect(result).toHaveLength(2);
  });

  it("removes a heading whose last line is gone", () => {
    // Otherwise "onion" stays on the page with nothing under it, which reads
    // as a rendering bug rather than as an empty group.
    const result = dropItem(groups(), 3);

    expect(result.map((group) => group.ingredient)).toEqual(["ground beef"]);
  });
});
