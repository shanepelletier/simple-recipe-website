import { describe, expect, it } from "vitest";

import { formatPreview } from "./format";
import type { Unit } from "./models";

const unit = (name: string, plural: string, takes_of: boolean): Unit => ({
  id: 1,
  name,
  plural,
  abbreviation: "",
  category: "mass",
  takes_of,
});

const pound = unit("pound", "pounds", true);
const cup = unit("cup", "cups", true);
const whole = unit("whole", "whole", false);

describe("formatPreview", () => {
  it("pluralises the unit above one", () => {
    expect(formatPreview("2", pound, "beef")).toBe("2 pounds of beef");
  });

  it("keeps the unit singular at exactly one", () => {
    expect(formatPreview("1", pound, "beef")).toBe("1 pound of beef");
  });

  it("pluralises for a fraction", () => {
    expect(formatPreview("0.5", cup, "flour")).toBe("0.5 cups of flour");
  });

  it('drops "of" for count units', () => {
    expect(formatPreview("1", whole, "orange")).toBe("1 whole orange");
  });

  it("cannot pluralise the ingredient, and that is the documented divergence", () => {
    // The server says "3 whole oranges", because it has a stored plural column
    // to read. The client has no plural until an ingredient is picked, and
    // guessing one with `+ "s"` would be wrong for "3 whole spaghetti".
    //
    // Pinning a known difference as an assertion rather than a comment is what
    // stops someone "fixing" it later.
    expect(formatPreview("3", whole, "orange")).toBe("3 whole orange");
  });

  it("is empty until all three parts are filled in", () => {
    expect(formatPreview("", pound, "beef")).toBe("");
    expect(formatPreview("2", null, "beef")).toBe("");
    expect(formatPreview("2", pound, "")).toBe("");
  });
});
