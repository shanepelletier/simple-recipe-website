import { describe, expect, it } from "vitest";

import { nextDestination, returnTo, safeNext, withNext } from "./next";

describe("safeNext", () => {
  it("keeps a path on this site", () => {
    expect(safeNext("/shopping-list")).toBe("/shopping-list");
  });

  it("keeps the query string the guard put there", () => {
    expect(safeNext("/recipes/9/edit?tab=steps")).toBe("/recipes/9/edit?tab=steps");
  });

  it("falls back to the grid when there is no next at all", () => {
    expect(safeNext(null)).toBe("/");
  });

  it.for([
    ["//evil.com", "protocol-relative, reads as a path"],
    ["/\\evil.com", "the backslash variant browsers also accept"],
    ["https://evil.com", "an outright absolute URL"],
    ["javascript:alert(1)", "a scheme that is not navigation at all"],
    ["evil.com", "no leading slash, so not a path on this site"],
  ])("refuses %s", ([raw]) => {
    expect(safeNext(raw)).toBe("/");
  });
});

describe("returnTo", () => {
  it("carries the page you are standing on", () => {
    expect(returnTo({ pathname: "/recipes/9", search: "" })).toBe("/recipes/9");
  });

  it("keeps the query, which is part of where you are", () => {
    // A filtered grid is a different place from the grid, and coming back to
    // the unfiltered one would lose work the visitor did.
    expect(returnTo({ pathname: "/", search: "?tag=soup" })).toBe("/?tag=soup");
  });

  it("says nothing about the bare grid, which is where an absent next lands anyway", () => {
    expect(returnTo({ pathname: "/", search: "" })).toBeNull();
  });

  it("carries what a credentials page was already holding rather than the page itself", () => {
    // Otherwise the header's Register link on /login?next=… would send someone
    // to /register?next=/login and lose the destination on the way.
    expect(returnTo({ pathname: "/login", search: "?next=%2Fshopping-list" })).toBe(
      "/shopping-list",
    );
  });

  it("refuses an off-site next handed to a credentials page", () => {
    expect(returnTo({ pathname: "/login", search: "?next=https%3A%2F%2Fevil.com" })).toBeNull();
  });

  it("says nothing when a credentials page has nothing to carry", () => {
    expect(returnTo({ pathname: "/register", search: "" })).toBeNull();
  });
});

describe("withNext", () => {
  it("attaches an encoded destination", () => {
    expect(withNext("/login", "/recipes/9")).toBe("/login?next=%2Frecipes%2F9");
  });

  it("leaves the path bare when there is nothing to carry", () => {
    expect(withNext("/login", null)).toBe("/login");
  });

  it("encodes a destination that safeNext reads back unchanged", () => {
    // The writing half and the reading half live in the same file precisely so
    // that the round trip between them can be asserted rather than assumed.
    const url = new URL(withNext("/login", "/recipes/9?tab=steps"), "https://example.test");

    expect(safeNext(url.searchParams.get("next"))).toBe("/recipes/9?tab=steps");
  });
});

describe("nextDestination", () => {
  it.for([
    ["/shopping-list", "shopping list"],
    ["/recipes/new", "start a new recipe"],
    ["/recipes/9/edit", "edit that recipe"],
  ])("names %s", ([next, phrase]) => {
    expect(nextDestination(next)).toContain(phrase);
  });

  it("ignores the query string the guard carried along", () => {
    expect(nextDestination("/shopping-list?a=1")).toBe(nextDestination("/shopping-list"));
  });

  it.for([
    ["/", "the fallback safeNext hands back when there was no next at all"],
    ["/recipes/9", "a public page, which never bounces anyone to sign in"],
    ["/shopping-list/extra", "a near miss, matched whole rather than by prefix"],
    ["/anything-else", "a path this app does not have"],
  ])("says nothing about %s", ([next]) => {
    // Silence rather than a generic line: a crafted ?next= must not be able to
    // put "you were headed somewhere" on the page in the app's own voice.
    expect(nextDestination(next)).toBeNull();
  });
});
