import type { ShoppingGroup, ShoppingItem } from "./models";

// Both of these fold a write's result back into the list the server grouped,
// and neither re-groups or re-sorts. The server decides what shares a heading
// and in what order, and a list that rearranged itself under the person
// ticking things off would be worse than one that reloaded.

/** The list with one item replaced by the version the server just returned. */
export function replaceItem(groups: ShoppingGroup[], item: ShoppingItem): ShoppingGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((current) => (current.id === item.id ? item : current)),
  }));
}

/**
 * The list with one item gone — and with it any heading it was the last line
 * of, since a heading with nothing under it reads as a rendering bug.
 */
export function dropItem(groups: ShoppingGroup[], id: number): ShoppingGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.id !== id) }))
    .filter((group) => group.items.length > 0);
}
