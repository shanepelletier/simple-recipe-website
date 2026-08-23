import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ShoppingGroup, ShoppingItem, UnitGroup } from "../core/models";
import ShoppingList from "./ShoppingList";

const pound = {
  id: 1,
  name: "pound",
  plural: "pounds",
  abbreviation: "lb",
  category: "mass" as const,
  takes_of: true,
};

const unitGroups: UnitGroup[] = [{ category: "mass", label: "Mass", units: [pound] }];

const beef = { id: 7, name: "ground beef", plural: "ground beef" };

const item = (id: number, display: string, changes: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id,
  ingredient: beef,
  unit: pound,
  quantity: "1",
  display,
  is_checked: false,
  source_recipe_id: null,
  ...changes,
});

const twoGroups = (): ShoppingGroup[] => [
  {
    ingredient: "ground beef",
    items: [
      item(1, "3 pounds of ground beef", { source_recipe_id: 4 }),
      item(2, "1 cup of ground beef"),
    ],
  },
  { ingredient: "onion", items: [item(3, "2 whole onion")] },
];

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

let groups: ShoppingGroup[] = [];
let calls: string[] = [];
/** Set by the test that needs two writes in flight at the same time. */
let holdWrites = false;
let held: (() => void)[] = [];
/** A server that answers a PATCH with the state it kept, not the one it was
 *  asked for — the one case a checkbox driven by the click gets wrong. */
let patchRefuses = false;

function stubServer() {
  groups = twoGroups();
  calls = [];
  holdWrites = false;
  held = [];
  patchRefuses = false;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      calls.push(`${method} ${url}`);

      if (url.startsWith("/api/units/")) {
        return json({ groups: unitGroups });
      }
      if (url.startsWith("/api/ingredients/")) {
        return json({ results: [beef] });
      }
      if (method === "GET") {
        return json({ groups });
      }
      if (method === "DELETE") {
        return json({ deleted: true });
      }
      if (method === "PATCH") {
        if (holdWrites) {
          await new Promise<void>((resolve) => held.push(resolve));
        }
        const id = Number(url.split("/").at(-2));
        const changes = JSON.parse(init.body as string) as Partial<ShoppingItem>;
        const current = groups.flatMap((group) => group.items).find((row) => row.id === id);
        return json({ item: patchRefuses ? current : { ...current, ...changes } });
      }
      return json({ item: item(9, "1 pound of ground beef") });
    }),
  );
}

function show() {
  stubServer();
  render(
    <MemoryRouter>
      <ShoppingList />
    </MemoryRouter>,
  );
  return screen.findByRole("heading", { level: 2, name: "ground beef" });
}

const line = (text: string) => screen.getByText(text).closest("li") as HTMLElement;
const box = (text: string) => within(line(text)).getByRole("checkbox");
const remove = (text: string) => within(line(text)).getByRole("button", { name: "Remove" });

beforeEach(() => stubServer());
afterEach(() => vi.unstubAllGlobals());

describe("ShoppingList", () => {
  it("gives each ingredient one heading and each measure its own line under it", async () => {
    await show();

    // The feature, and the thing that must not read as a failed merge: pounds
    // and cups of the same ingredient are two lines of one entry.
    const group = screen.getByRole("heading", { level: 2, name: "ground beef" }).parentElement;
    const lines = within(group as HTMLElement).getAllByRole("listitem");
    expect(lines.map((row) => row.textContent)).toEqual([
      expect.stringContaining("3 pounds of ground beef"),
      expect.stringContaining("1 cup of ground beef"),
    ]);
  });

  it("takes the checkbox state from the response rather than from the click", async () => {
    await show();
    // The server refuses the change and says so by answering with the state it
    // kept. A box that followed the click would now be lying about the list.
    patchRefuses = true;

    fireEvent.click(box("1 cup of ground beef"));

    await waitFor(() => expect(calls).toContain("PATCH /api/shopping-list/2/"));
    expect((box("1 cup of ground beef") as HTMLInputElement).checked).toBe(false);
  });

  it("keeps a checked line where it was", async () => {
    await show();

    fireEvent.click(box("3 pounds of ground beef"));

    await waitFor(() =>
      expect((box("3 pounds of ground beef") as HTMLInputElement).checked).toBe(true),
    );
    expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      expect.stringContaining("3 pounds of ground beef"),
      expect.stringContaining("1 cup of ground beef"),
      expect.stringContaining("2 whole onion"),
    ]);
  });

  it("keeps both boxes ticked when two are ticked at once", async () => {
    await show();
    holdWrites = true;

    fireEvent.click(box("3 pounds of ground beef"));
    fireEvent.click(box("2 whole onion"));

    await waitFor(() => expect(held).toHaveLength(2));
    held.forEach((release) => release());

    // Both responses fold into the list as it stands when each arrives. Built
    // from the render they started in, the second would carry a copy of the
    // list from before the first landed and quietly untick it.
    await waitFor(() => expect((box("2 whole onion") as HTMLInputElement).checked).toBe(true));
    expect((box("3 pounds of ground beef") as HTMLInputElement).checked).toBe(true);
  });

  it("drops the heading when its last line is removed", async () => {
    await show();

    fireEvent.click(remove("2 whole onion"));

    await waitFor(() => expect(screen.queryByText("2 whole onion")).toBeNull());
    expect(screen.queryByRole("heading", { level: 2, name: "onion" })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "ground beef" })).toBeDefined();
  });

  it("refetches the whole list after an add, since the new item may have merged", async () => {
    await show();

    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Ingredient"), { target: { value: "ground beef" } });
    fireEvent.click(await screen.findByRole("button", { name: "ground beef" }));

    // What the server does with the add: it merges into the pounds line rather
    // than appearing as a fourth item, so the only honest answer is the list.
    groups[0].items[0] = item(1, "4 pounds of ground beef", { source_recipe_id: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));

    expect(await screen.findByText("4 pounds of ground beef")).toBeDefined();
    expect(calls.slice(-2)).toEqual(["POST /api/shopping-list/", "GET /api/shopping-list/"]);
  });

  it("links a line back to the recipe it came from, and only that line", async () => {
    await show();

    const fromRecipe = within(line("3 pounds of ground beef")).getByRole("link");
    expect(fromRecipe.getAttribute("href")).toBe("/recipes/4");
    // Null is ambiguous — added by hand, or the recipe was deleted — so the
    // line says nothing rather than guessing.
    expect(within(line("1 cup of ground beef")).queryByRole("link")).toBeNull();
  });

  it("says the list is empty rather than showing an empty page", async () => {
    groups = [];
    render(
      <MemoryRouter>
        <ShoppingList />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/list is empty/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Find a recipe" })).toBeDefined();
  });
});
