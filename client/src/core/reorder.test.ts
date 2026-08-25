import type { Announcements } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { reorderAnnouncements } from "./reorder";

/**
 * Read against directly rather than through a drag.
 *
 * Sorting is decided by comparing rectangles, and jsdom reports every element
 * as a 0×0 box at the origin — so a keyboard move can only be made to happen
 * by stubbing the geometry the sort reads, which then tests the stub and the
 * library's measuring pipeline rather than anything written here. Driven that
 * way it also failed about one run in ten on timing internal to the sort. That
 * the rows actually move is checked by dragging them in a browser; what these
 * strings say is ours, and this is where it is pinned down.
 */
describe("reorderAnnouncements", () => {
  const rows = [
    { key: 7, name: "beef" },
    { key: 8, name: "onion" },
    { key: 9, name: "garlic" },
  ];
  const said = reorderAnnouncements(rows, (row) => row.name);

  /** The shape the sort hands its announcements, narrowed to the two ids they
   *  actually read. */
  const between = (active: number, over: number | null) =>
    ({
      active: { id: active },
      over: over === null ? null : { id: over },
    }) as unknown as Parameters<Announcements["onDragOver"]>[0];

  it("says which row was picked up and where it stood", () => {
    expect(said.onDragStart(between(8, 8))).toBe("onion picked up. Position 2 of 3.");
  });

  it("stays quiet while a row is over the slot it already occupies", () => {
    // An over is reported the instant a row is lifted. Announcing a move here
    // would be untrue, and it would overwrite the pick-up that was just read.
    expect(said.onDragOver(between(8, 8))).toBeUndefined();
  });

  it("counts the position a row would take, not the one it came from", () => {
    expect(said.onDragOver(between(7, 9))).toBe("beef moved to position 3 of 3.");
  });

  it("says where a dropped row landed", () => {
    expect(said.onDragEnd(between(7, 9))).toBe("beef dropped at position 3 of 3.");
  });

  it("falls back to where a row started when it is dropped over nothing", () => {
    expect(said.onDragEnd(between(7, null))).toBe("beef dropped at position 1 of 3.");
  });

  it("names the place a cancelled row went back to", () => {
    expect(said.onDragCancel(between(9, 7))).toBe("Move cancelled. garlic is back at position 3.");
  });

  it("says nothing about a row that is no longer in the list", () => {
    // Removing a row mid-drag is not reachable by hand, but a stale id
    // producing "undefined picked up" would be the worst possible reading.
    expect(said.onDragStart(between(99, 99))).toBeUndefined();
  });
});
