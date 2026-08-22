import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";

import { AuthContext } from "./auth-context";
import type { AuthValue } from "./auth-context";
import { RequireAuth } from "./RequireAuth";

// The guard never calls these, so they only have to satisfy the type.
const noop = async () => {};
const base = { signIn: noop, signUp: noop, signOut: noop };

const signedIn: AuthValue = {
  ...base,
  ready: true,
  user: { id: 1, username: "alice", is_staff: false, is_moderator: false },
};
const signedOut: AuthValue = { ...base, ready: true, user: null };
const notReady: AuthValue = { ...base, ready: false, user: null };

function LoginProbe() {
  return <p>login{useLocation().search}</p>;
}

function renderGuarded(auth: AuthValue) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/shopping-list?a=1"]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route
            path="/shopping-list"
            element={
              <RequireAuth>
                <p>the list</p>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("RequireAuth", () => {
  it("renders the page for a signed-in user", () => {
    renderGuarded(signedIn);

    expect(screen.getByText("the list")).toBeDefined();
  });

  it("redirects a signed-out user to login, remembering where they were going", () => {
    renderGuarded(signedOut);

    expect(screen.queryByText("the list")).toBeNull();
    expect(screen.getByText(/login/).textContent).toContain("next=%2Fshopping-list%3Fa%3D1");
  });

  it("renders nothing until the session check has answered", () => {
    renderGuarded(notReady);

    expect(screen.queryByText("the list")).toBeNull();
    expect(screen.queryByText(/login/)).toBeNull();
  });
});

describe("useAuth", () => {
  it("refuses to run outside a provider rather than handing back a null context", () => {
    // Without the throw, every consumer would need its own null check and the
    // failure would surface as "cannot read property user of null" somewhere
    // far from the missing provider.
    expect(() =>
      render(
        <MemoryRouter>
          <RequireAuth>
            <p>the list</p>
          </RequireAuth>
        </MemoryRouter>,
      ),
    ).toThrow(/inside <AuthProvider>/);
  });
});
