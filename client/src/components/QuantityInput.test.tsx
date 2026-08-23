import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UnitGroup } from "../core/models";
import type { QuantityValue } from "../core/rows";
import { QuantityInput } from "./QuantityInput";

const unitGroups: UnitGroup[] = [
  {
    category: "mass",
    label: "Mass",
    units: [
      {
        id: 1,
        name: "pound",
        plural: "pounds",
        abbreviation: "lb",
        category: "mass",
        takes_of: true,
      },
    ],
  },
  {
    category: "count",
    label: "Count",
    units: [
      {
        id: 2,
        name: "whole",
        plural: "whole",
        abbreviation: "",
        category: "count",
        takes_of: false,
      },
    ],
  },
];

const empty: QuantityValue = { quantity: "", unitId: null, ingredientId: null, ingredientName: "" };

function respondWith(results: { id: number; name: string }[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ results: results.map((r) => ({ ...r, plural: r.name })) }), {
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

// The control is fully controlled, so a test that pins its value with a spy
// is not driving it — React skips onChange when the value never changes, and
// the dropdown never opens. This harness owns the state the way the form does.
function show(initial: Partial<QuantityValue> = {}, allowCreate = true) {
  const onChange = vi.fn();

  function Harness() {
    const [value, setValue] = useState<QuantityValue>({ ...empty, ...initial });
    return (
      <QuantityInput
        value={value}
        unitGroups={unitGroups}
        allowCreate={allowCreate}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  }

  render(<Harness />);
  return onChange;
}

const ingredientBox = () => screen.getByLabelText(/ingredient/i);

beforeEach(() => respondWith([]));
afterEach(() => vi.unstubAllGlobals());

describe("QuantityInput", () => {
  it("groups the units under the labels the API supplied", () => {
    show();

    const labels = [...document.querySelectorAll("optgroup")].map((g) => g.getAttribute("label"));
    expect(labels).toEqual(["Mass", "Count"]);
  });

  it("offers to create the ingredient the user actually typed", async () => {
    respondWith([]);
    show();

    fireEvent.change(ingredientBox(), { target: { value: "okra" } });

    // The typed word, not a fixed placeholder — this option is what creates an
    // ingredient the catalog doesn't have.
    expect(await screen.findByRole("button", { name: /create “okra”/i })).toBeDefined();
  });

  it("offers no dropdown at all where creating is not allowed and nothing matches", async () => {
    // The shopping list's endpoint takes an ingredient id and nothing else, so
    // an empty bordered box under the input would be the only thing left of a
    // control that could not have worked anyway.
    respondWith([]);
    show({}, false);

    fireEvent.change(ingredientBox(), { target: { value: "okra" } });

    await waitFor(() => expect(document.querySelector(".quantity__matches")).toBeNull());
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
  });

  it("does not offer to create one that already exists", async () => {
    respondWith([{ id: 9, name: "okra" }]);
    show();

    fireEvent.change(ingredientBox(), { target: { value: "okra" } });

    await waitFor(() => expect(screen.getByRole("button", { name: "okra" })).toBeDefined());
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
  });

  it("reports the id when an existing ingredient is picked", async () => {
    respondWith([{ id: 9, name: "okra" }]);
    const onChange = show();

    fireEvent.change(ingredientBox(), { target: { value: "okr" } });
    (await screen.findByRole("button", { name: "okra" })).click();

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ ingredientId: 9, ingredientName: "okra" }),
    );
  });

  it("forgets the picked id as soon as the name is edited", () => {
    // Otherwise editing "beef" into "beefsteak" keeps sending the id for beef,
    // and the recipe quietly gets an ingredient nobody asked for.
    const onChange = show({ ingredientName: "beef", ingredientId: 4 });

    fireEvent.change(ingredientBox(), { target: { value: "beefsteak" } });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ ingredientId: null, ingredientName: "beefsteak" }),
    );
  });

  it("previews the line once all three parts are filled in", () => {
    show({ quantity: "2", unitId: 1, ingredientName: "beef" });

    expect(screen.getByText("2 pounds of beef")).toBeDefined();
  });

  it("previews nothing while a part is missing", () => {
    show({ quantity: "2", unitId: null, ingredientName: "beef" });

    expect(screen.queryByText(/pounds/)).toBeNull();
  });
});
