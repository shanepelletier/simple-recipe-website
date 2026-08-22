import type { Unit } from "./models";

/**
 * The client-side echo of the server's format_quantity(). **Preview only** —
 * every string the user actually reads comes from the API's `display` field.
 *
 * Yes, this duplicates logic that already exists on the server, and that is a
 * deliberate trade rather than an oversight: the preview updates on every
 * keystroke, and a round trip per keystroke to render a label would be absurd.
 * The duplication is contained to this one function, both copies are tested
 * against the same table, and the copy that gets *displayed* anywhere outside
 * a half-filled form is always the server's.
 */
export function formatPreview(quantity: string, unit: Unit | null, ingredientName: string): string {
  if (quantity === "" || unit === null || ingredientName === "") {
    return "";
  }
  const unitWord = Number(quantity) === 1 ? unit.name : unit.plural;
  return unit.takes_of
    ? `${quantity} ${unitWord} of ${ingredientName}`
    : `${quantity} ${unitWord} ${ingredientName}`;
}
