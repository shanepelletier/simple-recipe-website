import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SortableRows } from "./SortableRows";

interface Row {
  key: number;
  name: string;
}

function Harness() {
  const [rows, setRows] = useState<Row[]>([
    { key: 1, name: "beef" },
    { key: 2, name: "onion" },
  ]);
  return (
    <SortableRows
      className="rows"
      items={rows}
      describe={(row) => row.name}
      onMove={(from, to) =>
        setRows((current) => {
          const next = [...current];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return next;
        })
      }
    >
      {(row) => <span>{row.name}</span>}
    </SortableRows>
  );
}

/** Every <li> in the list, in the order they are on the page. */
const listRows = () => [...document.querySelectorAll("li")];

afterEach(() => vi.unstubAllGlobals());

describe("SortableRows", () => {
  it("names each handle after the row it picks up", () => {
    render(<Harness />);

    // The handles are otherwise six identical dots repeated down the page,
    // and a screen reader would read them as the same control twice.
    expect(screen.getByRole("button", { name: "Reorder beef" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Reorder onion" })).toBeDefined();
  });

  it("tells assistive tech the handle is more than a button", () => {
    render(<Harness />);

    // Without the role description, "Reorder beef, button" gives no hint that
    // this one can be picked up and carried.
    expect(
      screen.getByRole("button", { name: "Reorder beef" }).getAttribute("aria-roledescription"),
    ).toBe("sortable row");
  });

  it("moves nothing at rest", () => {
    render(<Harness />);

    // Rows carry no transform until something is actually being dragged, so a
    // list nobody has touched has no inline geometry of its own to go stale.
    expect(listRows().map((row) => row.style.transform)).toEqual(["", ""]);
  });

  it("stands still for a reader who asked their system for less motion", () => {
    vi.stubGlobal("matchMedia", (media: string) => ({
      media,
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    render(<Harness />);

    // The rows still arrive where they are put; they just stop sliding there.
    // A shortened duration would not be honouring the request, only hedging it.
    expect(listRows().map((row) => row.style.transition)).toEqual(["", ""]);
  });
});
