import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";

import App from "./App";
import { AuthContext } from "./core/auth-context";
import type { AuthValue } from "./core/auth-context";
import { nextDestination } from "./core/next";
import { ROUTES } from "./core/routes";

const noop = async () => {};
const base = { ready: true, justSignedOut: false, signIn: noop, signUp: noop, signOut: noop };

const signedIn: AuthValue = {
  ...base,
  user: { id: 1, username: "alice", is_staff: false, is_moderator: false },
};
const signedOut: AuthValue = { ...base, user: null };

function renderAt(path: string, auth: AuthValue) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function Where() {
  return <p>at {useLocation().pathname}</p>;
}

/**
 * Renders signed in, with a sign-out that really signs you out and a probe
 * reporting the path.
 *
 * Both halves are needed. What sign-out does depends on the user going away,
 * which the fixed AuthValue above cannot express; and it leaves the visitor on
 * a page whose *content* is unchanged, so the assertion has to be about where
 * the app went rather than what it drew.
 */
function renderSignOutAt(path: string) {
  function Harness() {
    const [user, setUser] = useState(signedIn.user);
    const auth: AuthValue = {
      ...base,
      user,
      justSignedOut: user === null,
      signOut: async () => setUser(null),
    };
    return (
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <App />
          <Where />
        </MemoryRouter>
      </AuthContext.Provider>
    );
  }
  render(<Harness />);
  return () => screen.getByText(/^at /).textContent;
}

/**
 * Clicks Sign out and waits for the user to actually be gone.
 *
 * Where the app ends up is asserted with waitFor rather than after a flush,
 * because a redirect out of a guarded page is a router transition and neither
 * act() nor yielding a macrotask commits one. The button disappearing only
 * proves the user went away; it says nothing about navigation yet.
 */
async function signOutAndSettle() {
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

  await waitFor(() => expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull());
}

/**
 * Queries scoped to <main>, i.e. to whatever the route rendered.
 *
 * Scoping is not tidiness here — the header carries a "Sign in" link and a
 * "Shopping list" link, so an unscoped query for either matches the chrome as
 * well as the page and can pass while the route is doing the wrong thing.
 */
const page = () => within(screen.getByRole("main"));

/**
 * "/recipes/:id/edit" -> "/recipes/9/edit", so a route can actually be visited.
 *
 * The 9 is arbitrary — nothing here fetches, so no route cares what the id is.
 * Any string would do; it is a digit only because that is what a recipe id
 * looks like, and reading "/recipes/9/edit" in a failure message is easier
 * than reading "/recipes/x/edit".
 */
const withParams = (path: string) => path.replace(/:\w+/g, "9");

// The exceptions to "every route is guarded". A route added to ROUTES and not
// named here has to be guarded, or the first test fails — which is the point.
// A list of routes *to check* would be exactly as easy to forget as the guard,
// so this is a list of routes to skip instead.
const PUBLIC = new Set(["/", "/recipes/:id", "/login", "/register", "*"]);

const guardedRoutes = ROUTES.filter((route) => route.guarded);

describe("routes", () => {
  it.for(ROUTES)("$path is guarded unless it is a known public route", ({ path, guarded }) => {
    expect(guarded).toBe(!PUBLIC.has(path));
  });

  // Without this, `guarded` would just be a field somebody set: flipping the
  // ternary in App to always render `element` would satisfy the test above
  // while unguarding the entire app.
  it.for(guardedRoutes)("$path sends an anonymous visitor to the login page", async ({ path }) => {
    renderAt(withParams(path), signedOut);

    // By heading, not by text: the login page's submit button also says
    // "Sign in", and so does a link in the header.
    expect(await page().findByRole("heading", { level: 1, name: "Sign in" })).toBeDefined();
  });

  // And without this, guarding everything unconditionally would pass both.
  //
  // Asserted against the page's <h1> rather than its text, so this keeps
  // working as each page grows past its stub. Level 1 specifically: pages with
  // sections have <h2>s too, and "the heading" stops being unambiguous.
  it.for(guardedRoutes)("$path lets a signed-in user through", async ({ path }) => {
    renderAt(withParams(path), signedIn);

    expect((await page().findByRole("heading", { level: 1 })).textContent).not.toBe("Sign in");
  });

  // The bounce is only half the flow: the page it lands on has to say what it
  // interrupted, or a guarded route added later quietly starts sending people
  // to a sign-in form with no explanation. Swept from the same table for the
  // same reason the guard itself is — a hand-kept list of routes that need a
  // line would be exactly as easy to forget as the line.
  it.for(guardedRoutes)("$path names itself on the page it bounces to", ({ path }) => {
    expect(nextDestination(withParams(path))).not.toBeNull();
  });

  // Signing in from a public page is the other way to reach the form, and it
  // used to lose where you were: the header's link was a bare /login, so a
  // visitor who signed in from a recipe was returned to the grid.
  it("keeps the page you were on when you sign in from the header", () => {
    renderAt("/recipes/9", signedOut);

    const header = within(screen.getByRole("banner"));

    expect(header.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
      "/login?next=%2Frecipes%2F9",
    );
  });

  it("leaves you on a public page when you sign out", async () => {
    // The recipe reads the same signed out, so being moved off it would be a
    // penalty for using the control.
    const at = renderSignOutAt("/recipes/9");

    await signOutAndSettle();

    // Nothing to wait for, because nothing should move: the guard is not on a
    // public page and the header no longer redirects.
    expect(at()).toBe("at /recipes/9");
  });

  it("sends you to the grid when you sign out of a page you can no longer see", async () => {
    // And to the grid rather than to /login: the guard would otherwise bounce
    // an anonymous visitor there carrying a `next` back to the list, asking
    // them to sign in again the instant they signed out.
    const at = renderSignOutAt("/shopping-list");

    await signOutAndSettle();

    await waitFor(() => expect(at()).toBe("at /"));
  });

  it("sends an unknown path to the grid", async () => {
    renderAt("/nonsense", signedOut);

    expect((await page().findByRole("heading", { level: 1 })).textContent).toBe("Recipes");
  });

  it("renders nothing at all until the session check has answered", () => {
    renderAt("/", { ...signedOut, ready: false });

    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
  });
});
