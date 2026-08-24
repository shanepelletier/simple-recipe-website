import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { RecipeCard } from "../components/RecipeCard";
import * as api from "../core/api";
import type { RecipeQuery } from "../core/api";
import { hasActiveFilters } from "../core/filters";
import { useApi } from "../core/useApi";

const SORTS = [
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["name", "Name"],
  ["rating", "Rating"],
];

const SEARCH_DEBOUNCE_MS = 300;

export default function RecipeGrid() {
  const [searchParams, setSearchParams] = useSearchParams();

  // The URL is the single source of truth, so a filtered view is shareable by
  // copying it and the back button undoes a filter change for free. Keeping
  // the same state in the component as well would be more code, not less.
  //
  // `tag` is pulled out with `getAll` rather than folded into the
  // `Object.fromEntries` below, since `fromEntries` keeps only the last value
  // for a repeated key and a repeating `?tag=` is exactly what this filter
  // needs to preserve.
  const query = useMemo(
    () => ({
      ...(Object.fromEntries(searchParams) as RecipeQuery),
      tag: searchParams.getAll("tag"),
    }),
    [searchParams],
  );

  const { data, loading, error, reload } = useApi(
    () => api.recipes(query),
    // The string, not the object: searchParams is a fresh instance on some
    // renders, while the string only changes when the query really does.
    [searchParams.toString()],
  );
  const tags = useApi(() => api.tags(), []);

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      // Back to page one. Without this, changing a filter while on page 4 of
      // the old results shows an empty page 4 of the new ones, and the user
      // concludes the search is broken.
      next.delete("page");
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  // Tags get their own setter rather than reusing setFilter: a checked tag
  // adds to the existing set, an unchecked one removes just itself, and
  // every other filter's set-or-delete-one-value shape doesn't cover that.
  const toggleTag = useCallback(
    (name: string, checked: boolean) => {
      const next = new URLSearchParams(searchParams);
      next.delete("tag");
      const current = searchParams.getAll("tag");
      const updated = checked ? [...current, name] : current.filter((tag) => tag !== name);
      for (const tag of updated) {
        next.append("tag", tag);
      }
      next.delete("page");
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const urlSearch = query.search ?? "";
  const [searchText, setSearchText] = useState(urlSearch);
  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Adjusting state during render rather than in an effect, which is what
  // React recommends for "this state is stale relative to something that
  // changed". The case it handles is the back button: the URL reverts, and
  // the box has to follow it or it keeps showing a search that is no longer
  // applied. Comparing against the previous URL value — rather than against
  // searchText — is what stops it from fighting the user mid-type.
  if (urlSearch !== lastUrlSearch) {
    setLastUrlSearch(urlSearch);
    setSearchText(urlSearch);
  }

  // Debouncing in the handler rather than in an effect keeps the timer out of
  // the render cycle entirely: no dependency array to get wrong, and no
  // redundant history entry pushed on mount or on a back navigation.
  function onSearchChange(value: string) {
    setSearchText(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setFilter("search", value), SEARCH_DEBOUNCE_MS);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  }

  const filtered = hasActiveFilters(searchParams);

  return (
    <>
      <h1>Recipes</h1>

      {/* Source order is the visual order and the tab order: the three narrow
          controls sit on one line, and the tag checkboxes take the line below
          because there are eight of them. Laying this out with CSS `order`
          instead would leave someone tabbing through it jumping around the
          row. */}
      <div className="filters">
        <label className="filters__search">
          Search
          <input
            type="search"
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        {/* The label is what makes the bare numbers mean anything: this is a
            threshold, so 3 shows 3, 4 and 5. "Any" is not the same as 1 —
            unrated recipes are annotated 0.0 server-side, so 1 excludes them
            and means "has been rated at all". */}
        <label>
          Minimum rating
          <select
            value={query.min_rating ?? ""}
            onChange={(event) => setFilter("min_rating", event.target.value)}
          >
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((rating) => (
              <option key={rating} value={String(rating)}>
                {rating}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort
          <select
            value={query.sort ?? "newest"}
            onChange={(event) => setFilter("sort", event.target.value)}
          >
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {filtered && (
          <button type="button" onClick={() => setSearchParams(new URLSearchParams())}>
            Clear filters
          </button>
        )}

        {/* Checked tags AND together — a recipe must carry all of them —
            matching how the server's repeating `?tag=` filters. */}
        <fieldset className="tag-filter">
          <legend>Tags</legend>
          {(tags.data?.results ?? []).map((tag) => (
            <label key={tag.id}>
              <input
                type="checkbox"
                checked={(query.tag ?? []).includes(tag.name)}
                onChange={(event) => toggleTag(tag.name, event.target.checked)}
              />
              {tag.name}
            </label>
          ))}
        </fieldset>
      </div>

      <Results
        data={data}
        loading={loading}
        failed={error !== null}
        filtered={filtered}
        onRetry={reload}
        onClearFilters={() => setSearchParams(new URLSearchParams())}
        onPage={goToPage}
      />
    </>
  );
}

interface ResultsProps {
  data: Awaited<ReturnType<typeof api.recipes>> | null;
  loading: boolean;
  failed: boolean;
  filtered: boolean;
  onRetry: () => void;
  onClearFilters: () => void;
  onPage: (page: number) => void;
}

function Results({
  data,
  loading,
  failed,
  filtered,
  onRetry,
  onClearFilters,
  onPage,
}: ResultsProps) {
  if (failed) {
    return (
      <div className="state">
        <p>Couldn&rsquo;t load recipes.</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  // Skeletons rather than a spinner or a blank screen, and built from the same
  // parts as a real card — photo box plus four text lines — rather than a bare
  // 4:3 block. A block only reserves the height of the photo, so the grid still
  // jumped by the height of the name, rating, tags and owner at the moment the
  // results landed, which is the exact reflow the skeletons exist to prevent.
  if (loading || data === null) {
    return (
      <div className="grid" aria-busy="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="card card--skeleton" aria-hidden="true">
            <div className="card__photo" />
            <div className="card__lines">
              <span className="card__line card__line--name" />
              <span className="card__line card__line--rating" />
              <span className="card__line card__line--tags" />
              <span className="card__line card__line--owner" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.results.length === 0) {
    // Two genuinely different situations. Someone who typed a search wants to
    // know their search failed, not that the site is empty.
    return filtered ? (
      <div className="state">
        <p>No recipes match these filters.</p>
        <button type="button" onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    ) : (
      <div className="state">
        <p>No recipes yet — add the first one.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid">
        {data.results.map((recipe) => (
          // Keyed by id, never by array index — see what index keys do to a
          // list that changes in the recipe form.
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>

      {data.pages > 1 && (
        <nav className="pager">
          <button type="button" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
            Previous
          </button>
          <span>
            Page {data.page} of {data.pages}
          </span>
          <button
            type="button"
            disabled={data.page >= data.pages}
            onClick={() => onPage(data.page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}
