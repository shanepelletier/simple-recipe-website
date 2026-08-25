import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Tag } from "../core/models";
import { TagField } from "./TagField";

const TAGS: Tag[] = [
  { id: 1, name: "vegan" },
  { id: 2, name: "vegetarian" },
  { id: 3, name: "quick" },
];

/** Renders the field over real state, so adding a token is visible to the
 *  next assertion the way it is to the next keystroke. */
function Picker({ max = null, start = [] }: { max?: number | null; start?: string[] }) {
  const [selected, setSelected] = useState(start);
  return (
    <TagField
      id="tags"
      label="Tags"
      options={TAGS}
      selected={selected}
      max={max}
      onAdd={(tag) => setSelected((current) => [...current, tag.name])}
      onRemove={(name) => setSelected((current) => current.filter((tag) => tag !== name))}
    />
  );
}

const box = () => screen.getByLabelText("Tags");
const type = (value: string) => fireEvent.change(box(), { target: { value } });
const tokens = () =>
  screen
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"))
    .filter((label) => label?.startsWith("Remove"));

describe("TagField", () => {
  it("narrows the menu to what was typed, case-insensitively", () => {
    render(<Picker />);

    type("VEG");

    expect(screen.getByRole("button", { name: "vegan" })).toBeDefined();
    expect(screen.getByRole("button", { name: "vegetarian" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "quick" })).toBeNull();
  });

  it("takes the first match on Enter and clears the query", () => {
    render(<Picker />);

    type("veg");
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(tokens()).toEqual(["Remove vegan"]);
    // Cleared, or "veg" would go on hiding vegetarian for no stated reason and
    // the menu would look broken rather than filtered.
    expect((box() as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "quick" })).toBeDefined();
  });

  it("keeps Enter to itself when there is nothing to take", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Picker />
      </form>,
    );

    type("nothing matches this");
    fireEvent.keyDown(box(), { key: "Enter" });

    // Left unhandled, Enter reaches the form around the field and saves the
    // recipe — which is not what pressing it inside a picker asks for.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("removes the last token on Backspace in an empty box", () => {
    render(<Picker start={["vegan", "quick"]} />);

    fireEvent.keyDown(box(), { key: "Backspace" });

    expect(tokens()).toEqual(["Remove vegan"]);
  });

  it("leaves the tokens alone when Backspace has text to delete instead", () => {
    render(<Picker start={["vegan"]} />);

    type("qu");
    fireEvent.keyDown(box(), { key: "Backspace" });

    expect(tokens()).toEqual(["Remove vegan"]);
  });

  it("takes the caret out at the cap and says how to get it back", () => {
    render(<Picker max={2} start={["vegan"]} />);

    expect(screen.getByText("1 of 2 tags chosen.")).toBeDefined();
    expect((box() as HTMLInputElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "quick" }));

    expect((box() as HTMLInputElement).disabled).toBe(true);
    // Names the recovery, not just the limit.
    expect(screen.getByText("All 2 tags used — remove one to choose another.")).toBeDefined();
  });

  it("names which dead end the menu is at", () => {
    render(<Picker start={["vegan", "vegetarian", "quick"]} />);
    expect(screen.getByText("Every tag is already applied.")).toBeDefined();
  });

  it("says so when there are no tags at all", () => {
    render(
      <TagField
        id="tags"
        label="Tags"
        options={[]}
        selected={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("No tags exist yet.")).toBeDefined();
  });

  it("shows a chosen tag the vocabulary no longer has, so it can be taken off", () => {
    // The grid's selection comes out of the URL, where a tag an admin has
    // since deleted can still appear. Dropping it from the tokens would leave
    // a filter nobody can see and nobody can clear.
    render(<Picker start={["retired"]} />);

    expect(tokens()).toEqual(["Remove retired"]);
  });
});
