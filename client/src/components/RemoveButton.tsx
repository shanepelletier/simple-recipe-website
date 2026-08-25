/**
 * Takes a row off a list — an ingredient off a recipe being written, a line
 * off the shopping list.
 *
 * The mark is drawn at the same stroke weight as the select's chevron and the
 * tag token's close mark; a typed × would inherit the text font and go stale
 * against every other mark in the app. The target stays 44px square even
 * though the mark is small, because both lists get used one-handed in a
 * kitchen.
 *
 * `label` is the whole sentence — "Remove 2 cups of flour" — and the tooltip
 * stays the single word. Eleven rows each spelling out "Remove …" in visible
 * text is a wall of words rather than eleven pieces of information, which is
 * the same call the detail page makes when it labels its buttons "Add"; what
 * a screen reader hears is not what the eye has to wade through.
 */
export function RemoveButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title="Remove"
      disabled={disabled}
      onClick={onClick}
    >
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M3.5 3.5l7 7M10.5 3.5l-7 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
