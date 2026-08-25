import type { Announcements } from "@dnd-kit/core";

/**
 * What gets said out loud as a row travels.
 *
 * A reorder announces nothing by itself: the rows have not changed their text,
 * and a screen reader has no way to notice that two of them swapped. This is
 * the only account of the move its reader gets, which is why it lives out here
 * where it can be read against on its own rather than through a drag.
 */
export function reorderAnnouncements<T extends { key: number }>(
  items: T[],
  describe: (item: T, index: number) => string,
): Announcements {
  const at = (id: number | string) => {
    const index = items.findIndex((item) => item.key === id);
    return index === -1 ? null : { name: describe(items[index], index), position: index + 1 };
  };

  return {
    onDragStart: ({ active }) => {
      const row = at(active.id);
      return row === null
        ? undefined
        : `${row.name} picked up. Position ${row.position} of ${items.length}.`;
    },
    onDragOver: ({ active, over }) => {
      const row = at(active.id);
      const target = over === null ? null : at(over.id);
      // Silent while the row is over its own slot. An `over` is reported the
      // instant a row is picked up, and announcing "moved to position 1" for a
      // row that has not moved is both untrue and loud enough to wipe out the
      // "picked up" that was read a moment earlier.
      return row === null || target === null || target.position === row.position
        ? undefined
        : `${row.name} moved to position ${target.position} of ${items.length}.`;
    },
    onDragEnd: ({ active, over }) => {
      const row = at(active.id);
      const target = over === null ? null : at(over.id);
      return row === null
        ? undefined
        : `${row.name} dropped at position ${(target ?? row).position} of ${items.length}.`;
    },
    onDragCancel: ({ active }) => {
      const row = at(active.id);
      return row === null
        ? undefined
        : `Move cancelled. ${row.name} is back at position ${row.position}.`;
    },
  };
}
