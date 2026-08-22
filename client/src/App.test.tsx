import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import App from "./App";
import { AuthContext } from "./core/auth-context";
import type { AuthValue } from "./core/auth-context";
import { ROUTES } from "./core/routes";

const noop = async () => {};
const base = { ready: true, signIn: noop, signUp: noop, signOut: noop };

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
    expect(await page().findByRole("heading", { name: "Sign in" })).toBeDefined();
  });

  // And without this, guarding everything unconditionally would pass both.
  //
  // Asserted against the page's heading rather than its text, so this keeps
  // working as each page grows past its stub: every page has exactly one <h1>,
  // and the only thing that matters here is that it isn't the login page's.
  it.for(guardedRoutes)("$path lets a signed-in user through", async ({ path }) => {
    renderAt(withParams(path), signedIn);

    expect((await page().findByRole("heading")).textContent).not.toBe("Sign in");
  });

  it("sends an unknown path to the grid", async () => {
    renderAt("/nonsense", signedOut);

    expect((await page().findByRole("heading")).textContent).toBe("Recipes");
  });

  it("renders nothing at all until the session check has answered", () => {
    renderAt("/", { ...signedOut, ready: false });

    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
  });
});
