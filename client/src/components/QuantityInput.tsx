import { useMemo, useRef, useState } from "react";

import * as api from "../core/api";
import { formatPreview } from "../core/format";
import type { Ingredient, UnitGroup } from "../core/models";
import type { QuantityValue } from "../core/rows";

const AUTOCOMPLETE_DEBOUNCE_MS = 250;

interface Props {
  value: QuantityValue;
  onChange: (value: QuantityValue) => void;
  /** Passed in rather than fetched here — one request for the whole form. */
  unitGroups: UnitGroup[];
  /**
   * Whether typing a name the catalog doesn't have offers to create it.
   *
   * False on the shopping list, whose endpoint takes an `ingredient_id` and
   * nothing else: offering "Create okra" there would be a control that can
   * only end in the server refusing it. Recipes are where ingredients come
   * from, so that is where the option belongs.
   */
  allowCreate?: boolean;
}

export function QuantityInput({ value, onChange, unitGroups, allowCreate = true }: Props) {
  const [matches, setMatches] = useState<Ingredient[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const units = useMemo(() => unitGroups.flatMap((group) => group.units), [unitGroups]);
  const unit = units.find((candidate) => candidate.id === value.unitId) ?? null;

  // The sentence forming underneath as the three boxes fill in is the point of
  // this control, not decoration: three separate inputs feel bureaucratic, and
  // "2 pounds of beef" appearing as you type feels like writing a recipe.
  const preview = formatPreview(value.quantity, unit, value.ingredientName);

  function onIngredientTyped(name: string) {
    // Typing invalidates any previous pick — otherwise editing "beef" into
    // "beefsteak" would silently keep sending the id for beef.
    onChange({ ...value, ingredientName: name, ingredientId: null });
    setOpen(true);

    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void api
        .ingredients(name)
        .then(({ results }) => setMatches(results))
        .catch(() => setMatches([]));
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  }

  function pick(ingredient: Ingredient) {
    onChange({ ...value, ingredientName: ingredient.name, ingredientId: ingredient.id });
    setOpen(false);
  }

  function createNew() {
    // Keeps the typed text and leaves the id null, which is what tells the
    // request to send a name for the server to create.
    onChange({ ...value, ingredientId: null });
    setOpen(false);
  }

  const typed = value.ingredientName.trim();
  const exactMatch = matches.some(
    (candidate) => candidate.name.toLowerCase() === typed.toLowerCase(),
  );
  const offerCreate = allowCreate && !exactMatch;

  return (
    <div className="quantity">
      <label className="quantity__amount">
        Quantity
        {/* Held as a string all the way to the request, so no decimal drifts
            through a float round-trip. */}
        <input
          type="number"
          step="0.001"
          min="0"
          value={value.quantity}
          onChange={(event) => onChange({ ...value, quantity: event.target.value })}
        />
      </label>

      <label className="quantity__unit">
        Unit
        <select
          value={value.unitId ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              unitId: event.target.value === "" ? null : Number(event.target.value),
            })
          }
        >
          <option value="">Choose…</option>
          {unitGroups.map((group) => (
            // Group labels come from the API, not from a hardcoded list —
            // adding a category server-side should need no client change.
            <optgroup key={group.category} label={group.label}>
              {group.units.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="quantity__ingredient">
        Ingredient
        <input
          type="text"
          autoComplete="off"
          value={value.ingredientName}
          onChange={(event) => onIngredientTyped(event.target.value)}
          onFocus={() => setOpen(true)}
        />
        {/* Nothing to offer means no dropdown at all, rather than an empty
            bordered box hanging under the input. */}
        {open && typed !== "" && (matches.length > 0 || offerCreate) && (
          <ul className="quantity__matches">
            {matches.map((ingredient) => (
              <li key={ingredient.id}>
                <button type="button" onClick={() => pick(ingredient)}>
                  {ingredient.name}
                </button>
              </li>
            ))}
            {offerCreate && (
              <li>
                {/* The typed text, not a placeholder — this is the option that
                    creates an ingredient the catalog doesn't have yet. */}
                <button type="button" onClick={createNew}>
                  Create “{typed}”
                </button>
              </li>
            )}
          </ul>
        )}
      </label>

      {/* Rendered whether or not there is a sentence yet: the line holds its
          own height, so a row does not change shape on the keystroke that
          completes it. */}
      <p className="quantity__preview">{preview}</p>
    </div>
  );
}
