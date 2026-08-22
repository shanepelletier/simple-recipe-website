import { describe, expect, it } from "vitest";

import { safeNext } from "./next";

describe("safeNext", () => {
  it("keeps a path on this site", () => {
    expect(safeNext("/shopping-list")).toBe("/shopping-list");
  });

  it("keeps the query string the guard put there", () => {
    expect(safeNext("/recipes/9/edit?tab=steps")).toBe("/recipes/9/edit?tab=steps");
  });

  it("falls back to the grid when there is no next at all", () => {
    expect(safeNext(null)).toBe("/");
  });

  it.for([
    ["//evil.com", "protocol-relative, reads as a path"],
    ["/\\evil.com", "the backslash variant browsers also accept"],
    ["https://evil.com", "an outright absolute URL"],
    ["javascript:alert(1)", "a scheme that is not navigation at all"],
    ["evil.com", "no leading slash, so not a path on this site"],
  ])("refuses %s", ([raw]) => {
    expect(safeNext(raw)).toBe("/");
  });
});
