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
