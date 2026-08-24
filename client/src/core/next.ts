/**
 * The path to send someone to after signing in, from `?next=` in the URL.
 *
 * `next` is attacker-controllable — it arrives in a link anyone can craft — so
 * it is only ever allowed to name a path on this site. Anything else falls
 * back to the grid rather than being followed:
 *
 *   - a bare path like `/shopping-list` is fine, and is the whole point
 *   - `//evil.com` and `/\evil.com` are protocol-relative URLs, which read as
 *     paths but resolve to another host
 *   - `https://evil.com` is the obvious case
 *
 * Rejecting rather than sanitizing is deliberate: there is no such thing as
 * "nearly a local path", and a redirect that quietly rewrites where you asked
 * to go is worse than one that sends you home.
 */
export function safeNext(raw: string | null): string {
  if (raw === null || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}

/** The two pages that send you somewhere else rather than being somewhere. */
const CREDENTIALS_PAGES = ["/login", "/register"];

/**
 * Where signing in should return you to, from wherever you are standing, or
 * null when there is nothing worth carrying.
 *
 * This is the half of the flow that has nothing to do with the guard. Being
 * bounced off the shopping list is one way to reach the sign-in form; the other
 * is choosing it — the header's link, or "Sign in to rate this recipe" — and
 * someone who signs in from a recipe means to end up back on that recipe, not
 * on the grid.
 */
export function returnTo(location: { pathname: string; search: string }): string | null {
  // Standing on /login already: what is worth carrying is not this page, which
  // would be a loop, but wherever this page was going to send you anyway.
  if (CREDENTIALS_PAGES.includes(location.pathname)) {
    const carried = safeNext(new URLSearchParams(location.search).get("next"));
    return carried === "/" ? null : carried;
  }
  const here = location.pathname + location.search;
  // The grid is where an absent `next` lands anyway, so saying so is noise.
  return here === "/" ? null : here;
}

/** `to` with a destination attached, or bare when there is none to attach. */
export function withNext(to: string, next: string | null): string {
  return next === null ? to : `${to}?next=${encodeURIComponent(next)}`;
}

// Every guarded route, and the sentence the credentials pages use to say where
// you were going. The list is exhaustive by construction — these are the three
// entries RequireAuth wraps — so adding a fourth guarded route without adding
// its line here shows up as a page that stops explaining itself.
const DESTINATIONS: [RegExp, string][] = [
  [/^\/shopping-list$/, "You were headed to your shopping list."],
  [/^\/recipes\/new$/, "You were about to start a new recipe."],
  [/^\/recipes\/\d+\/edit$/, "You were about to edit that recipe."],
];

/**
 * Where `next` was taking someone, phrased for the sign-in page, or null when
 * it names nothing this app guards.
 *
 * It lives beside safeNext because it answers a question about the same
 * attacker-controllable value, and the answer has to be just as closed: a path
 * that matches nothing produces no sentence at all rather than a generic one.
 * Otherwise any crafted `next` could put "you were headed somewhere" on the
 * page and lend a hand-made link the app's own voice.
 */
export function nextDestination(next: string): string | null {
  // The guard stores `pathname + search`, so the query has to come off before
  // matching — `/shopping-list?a=1` is the same destination as `/shopping-list`.
  const [path] = next.split("?");
  const match = DESTINATIONS.find(([pattern]) => pattern.test(path));
  return match === undefined ? null : match[1];
}
