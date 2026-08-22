/** Params that narrow the result set. `page` is navigation, not a filter. */
const FILTER_KEYS = ["search", "tag", "author", "min_rating"] as const;

/**
 * Whether the grid is showing a narrowed view, which is what separates "no
 * recipes match these filters" from "there are no recipes".
 *
 * `page` is excluded deliberately: count it and an empty page 4 of an
 * *unfiltered* grid claims nothing matched the filters and offers a Clear
 * Filters button that does nothing, because there are no filters. `sort` is
 * excluded for the same reason — it reorders, it never removes.
 */
export function hasActiveFilters(params: URLSearchParams): boolean {
  return FILTER_KEYS.some((key) => (params.get(key) ?? "") !== "");
}
