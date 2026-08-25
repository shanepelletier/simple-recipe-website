import { useState } from "react";
import type { KeyboardEvent } from "react";

import type { Tag } from "../core/models";

interface Props {
  /** Ties the label to the input, and namespaces the count line's own id. */
  id: string;
  /**
   * Rendered as the field's label. Omit it and pass `labelledBy` instead when
   * a heading beside the field already names it, so the name isn't said twice
   * on screen and the input still has one for assistive tech.
   */
  label?: string;
  labelledBy?: string;
  /** The whole vocabulary. What is already chosen is filtered out here. */
  options: Tag[];
  /**
   * The chosen tags, by name.
   *
   * Names rather than ids because a name is what both callers display, and
   * because the grid's selection comes out of the URL — where a tag the
   * vocabulary no longer contains can still appear, and still has to be
   * shown as a token so it can be taken off again.
   */
  selected: string[];
  /** The whole tag, since the grid filters by name and the form saves ids. */
  onAdd: (tag: Tag) => void;
  onRemove: (name: string) => void;
  /** The most tags this field accepts, or null when nothing caps it. */
  max?: number | null;
}

/**
 * A token field over a fixed vocabulary: chosen tags become tokens inside the
 * box, and everything else lives behind the caret.
 *
 * The control this replaced — every tag laid out at once as a checkbox — got
 * worse every time the product got richer, and the tag list is admin-editable
 * and unbounded. A row that fits eight tags is unusable at forty. This one's
 * footprint doesn't depend on how many tags exist.
 */
export function TagField({
  id,
  label,
  labelledBy,
  options,
  selected,
  onAdd,
  onRemove,
  max = null,
}: Props) {
  // Local, and deliberately not lifted into the URL or into form state: it
  // narrows what you *could* pick, which is no part of what has been picked.
  const [query, setQuery] = useState("");

  const full = max !== null && selected.length >= max;

  // Case-insensitive substring, matching how recipe search already behaves. A
  // picker stricter than the search box beside it would be a surprise.
  const matches = full
    ? []
    : options.filter(
        (tag) =>
          !selected.includes(tag.name) &&
          tag.name.toLowerCase().includes(query.trim().toLowerCase()),
      );

  function add(tag: Tag) {
    onAdd(tag);
    // Cleared so the menu goes back to showing everything: after adding
    // "vegan", leaving "veg" in the box hides "vegetarian" for no stated
    // reason, and the list looks broken rather than filtered.
    setQuery("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter belongs to this field whether or not there is a match to take.
    // Left unhandled it reaches the form around it and saves the recipe,
    // which is not what pressing Enter inside a picker asks for.
    if (event.key === "Enter") {
      event.preventDefault();
      if (matches.length > 0) {
        add(matches[0]);
      }
      return;
    }
    // Backspace on an empty box removes the last token — the behavior every
    // token field has, and the only way to undo a choice without the mouse.
    if (event.key === "Backspace" && query === "" && selected.length > 0) {
      event.preventDefault();
      onRemove(selected[selected.length - 1]);
    }
  }

  const countId = `${id}-count`;

  return (
    <div className="tagfield">
      {label !== undefined && (
        <label className="tagfield__label" htmlFor={id}>
          {label}
        </label>
      )}

      {/* The box carries the control chrome and the input inside it is bare,
          so the tokens and the caret read as the contents of one field rather
          than as widgets parked beside an input. */}
      <div className="tagfield__box">
        {selected.map((name) => (
          <button
            key={name}
            type="button"
            className="tagfield__token"
            aria-label={`Remove ${name}`}
            onClick={() => onRemove(name)}
          >
            {name}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path
                d="M1 1l8 8M9 1l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ))}
        <input
          id={id}
          className="tagfield__input"
          type="text"
          autoComplete="off"
          aria-labelledby={labelledBy}
          aria-describedby={max === null ? undefined : countId}
          value={query}
          disabled={full}
          placeholder={selected.length === 0 ? "Add a tag…" : ""}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>

      <ul className="tagfield__menu">
        {matches.map((tag) => (
          <li key={tag.id}>
            <button type="button" className="tagfield__option" onClick={() => add(tag)}>
              {tag.name}
            </button>
          </li>
        ))}
        {/* Four different dead ends, and naming which one it is saves the user
            working out whether they mistyped or ran out of tags. */}
        {matches.length === 0 && (
          <li className="tagfield__empty">
            {options.length === 0
              ? "No tags exist yet."
              : full
                ? "Remove a tag to choose another."
                : selected.length === options.length
                  ? "Every tag is already applied."
                  : `No tags match “${query.trim()}”.`}
          </li>
        )}
      </ul>

      {max !== null && (
        <p className="tagfield__count" id={countId}>
          {full
            ? `All ${max} tags used — remove one to choose another.`
            : `${selected.length} of ${max} tags chosen.`}
        </p>
      )}
    </div>
  );
}
