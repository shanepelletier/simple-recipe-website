import { useState } from "react";
import type { SubmitEvent } from "react";
import { Link } from "react-router";

import { QuantityInput } from "../components/QuantityInput";
import * as api from "../core/api";
import { asApiError } from "../core/client";
import type { ShoppingGroup, ShoppingItem, UnitGroup } from "../core/models";
import { emptyQuantity } from "../core/rows";
import type { QuantityValue } from "../core/rows";
import { dropItem, replaceItem } from "../core/shopping";
import { useApi } from "../core/useApi";
import { useUnits } from "../core/units";

export default function ShoppingList() {
  return (
    <>
      {/* Outside every state below on purpose: a list that is still loading, or
          that failed to load, is still the shopping list. Only the part under
          the heading depends on what the request did. */}
      <h1>Shopping list</h1>
      <List />
    </>
  );
}

function List() {
  const list = useApi(() => api.shoppingList(), []);
  const units = useUnits();

  if (list.loading || units.loading) {
    return <p>Loading your shopping list…</p>;
  }

  if (list.error !== null) {
    return (
      <div className="state">
        <p>Couldn&rsquo;t load your shopping list.</p>
        <button type="button" onClick={list.reload}>
          Retry
        </button>
      </div>
    );
  }

  const groups = list.data?.groups ?? [];

  // Both writes hand `setData` an updater rather than a new list built from
  // this render's `groups`. Ticking two lines quickly puts two requests in
  // flight, and the second response has to fold into the first's result — a
  // value computed here would be a list from before the first one landed, and
  // would silently untick it again.
  const onChanged = (item: ShoppingItem) =>
    list.setData((current) => ({ groups: replaceItem(current.groups, item) }));

  const onRemoved = (id: number) =>
    list.setData((current) => ({ groups: dropItem(current.groups, id) }));

  return (
    <>
      {groups.length === 0 ? (
        <div className="state">
          <p>Your shopping list is empty.</p>
          <p>
            <Link to="/">Find a recipe</Link> and add its ingredients.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <Group key={group.ingredient} group={group} onChanged={onChanged} onRemoved={onRemoved} />
        ))
      )}

      <AddItem unitGroups={units.data?.groups ?? []} onAdded={list.reload} />
    </>
  );
}

function Group({
  group,
  onChanged,
  onRemoved,
}: {
  group: ShoppingGroup;
  onChanged: (item: ShoppingItem) => void;
  onRemoved: (id: number) => void;
}) {
  return (
    // The heading is the feature, not decoration. "1 pound of ground beef" and
    // "1 cup of ground beef" are two lines because pounds and cups do not add
    // up, and a reviewer seeing them side by side has to read that as the
    // structure it is rather than as two rows the app failed to merge — hence
    // one ingredient name above, and its measures indented beneath it.
    <section className="shopping__group">
      <h2>{group.ingredient}</h2>
      <ul className="shopping__items">
        {group.items.map((item) => (
          <Row key={item.id} item={item} onChanged={onChanged} onRemoved={onRemoved} />
        ))}
      </ul>
    </section>
  );
}

function Row({
  item,
  onChanged,
  onRemoved,
}: {
  item: ShoppingItem;
  onChanged: (item: ShoppingItem) => void;
  onRemoved: (id: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run(action: () => Promise<void>) {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const onToggle = () =>
    void run(async () => {
      const { item: saved } = await api.updateShoppingItem(item.id, {
        is_checked: !item.is_checked,
      });
      onChanged(saved);
    });

  const onDelete = () =>
    void run(async () => {
      await api.deleteShoppingItem(item.id);
      onRemoved(item.id);
    });

  return (
    <li className={item.is_checked ? "shopping__row shopping__row--checked" : "shopping__row"}>
      <label>
        {/* Driven by the server's answer, never by the click. Ticking the box
            optimistically means a failed request leaves it ticked, and the
            list is then telling the user something that is not true. */}
        <input type="checkbox" checked={item.is_checked} disabled={busy} onChange={onToggle} />
        <span className="shopping__display">{item.display}</span>
      </label>

      {/* Shown only when the source is known. A null source_recipe_id is
          ambiguous — the item was added by hand, or its recipe has since been
          deleted (the FK is SET_NULL so the item survives) — and there is no
          way to tell those apart, so neither is claimed. */}
      {item.source_recipe_id !== null && (
        <Link className="shopping__source" to={`/recipes/${item.source_recipe_id}`}>
          From a recipe
        </Link>
      )}

      <button type="button" onClick={onDelete} disabled={busy}>
        Remove
      </button>

      {failed && <span role="alert">Didn&rsquo;t work. Try again.</span>}
    </li>
  );
}

function AddItem({ unitGroups, onAdded }: { unitGroups: UnitGroup[]; onAdded: () => void }) {
  const [value, setValue] = useState<QuantityValue>(emptyQuantity());
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }

    // The endpoint takes an ingredient id, so a name that was typed rather
    // than picked has nothing to send. The dropdown offers no "create" here
    // for the same reason.
    if (value.ingredientId === null || value.unitId === null || value.quantity.trim() === "") {
      setProblem("Pick an ingredient and a measurement, and say how much.");
      return;
    }

    setSaving(true);
    setProblem("");
    try {
      await api.addShoppingItem(value.ingredientId, value.unitId, value.quantity);
      setValue(emptyQuantity());
      // The whole list, not the item the response carries: an add merges into
      // an existing line whenever the ingredient and unit already match, so
      // "what changed" can be a quantity somewhere else on the page.
      onAdded();
    } catch (reason) {
      setProblem(asApiError(reason).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="shopping__add" onSubmit={onSubmit}>
      <h2>Add an item</h2>
      <QuantityInput
        value={value}
        unitGroups={unitGroups}
        allowCreate={false}
        onChange={setValue}
      />
      {problem !== "" && <p role="alert">{problem}</p>}
      <button type="submit" disabled={saving}>
        {saving ? "Adding…" : "Add to list"}
      </button>
    </form>
  );
}
