import { describe, expect, it } from "vitest";

import { hasActiveFilters } from "./filters";

const params = (query: string) => new URLSearchParams(query);

describe("hasActiveFilters", () => {
  it("is false for no query at all", () => {
    expect(hasActiveFilters(params(""))).toBe(false);
  });

  it("is false when only the page number is set", () => {
    // The bug this prevents: an empty page 4 of an unfiltered grid claiming
    // nothing matched the filters, with a Clear Filters button that does
    // nothing because there are none.
    expect(hasActiveFilters(params("page=4"))).toBe(false);
  });

  it("is false when only the sort order is set", () => {
    // Sorting reorders, it never removes, so it can't be why a page is empty.
    expect(hasActiveFilters(params("sort=name"))).toBe(false);
  });

  it("is false for a filter key present but empty", () => {
    expect(hasActiveFilters(params("search="))).toBe(false);
  });

  it("is true for any real filter", () => {
    expect(hasActiveFilters(params("tag=vegan"))).toBe(true);
    expect(hasActiveFilters(params("page=2&min_rating=4"))).toBe(true);
  });

  it("is true for min_rating=1, which is a real filter and not 'any'", () => {
    // Unrated recipes are annotated 0.0 server-side, so 1 excludes them.
    expect(hasActiveFilters(params("min_rating=1"))).toBe(true);
  });
});
