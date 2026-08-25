import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import { AuthContext } from "../core/auth-context";
import type { AuthValue } from "../core/auth-context";
import { CredentialsForm } from "./CredentialsForm";

// Only the `next` handling is under test here, so the action never runs.
const noop = async () => {};
const base = { justSignedOut: false, signIn: noop, signUp: noop, signOut: noop };
const signedOut: AuthValue = { ...base, ready: true, user: null };
const signedIn: AuthValue = {
  ...base,
  ready: true,
  user: { id: 1, username: "alice", is_staff: false, is_moderator: false },
};

function show(entry: string, auth: AuthValue = signedOut) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/shopping-list" element={<p>the list</p>} />
          <Route
            path="/login"
            element={
              <CredentialsForm
                title="Sign in"
                submitLabel="Sign in"
                pendingLabel="Signing in…"
                passwordAutoComplete="current-password"
                action={noop}
                alternate={{ to: "/register", label: "Need an account?" }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("CredentialsForm", () => {
  it("says where the guard was taking you", () => {
    show("/login?next=%2Fshopping-list");

    expect(screen.getByText("You were headed to your shopping list.")).toBeDefined();
  });

  it("says nothing when you came here on your own", () => {
    show("/login");

    expect(screen.queryByText(/You were/)).toBeNull();
  });

  it("hands the destination to the other page, so registering still lands there", () => {
    show("/login?next=%2Fshopping-list");

    expect(screen.getByRole("link", { name: "Need an account?" }).getAttribute("href")).toBe(
      "/register?next=%2Fshopping-list",
    );
  });

  it("links the other page plainly when there is no destination to carry", () => {
    show("/login");

    expect(screen.getByRole("link", { name: "Need an account?" }).getAttribute("href")).toBe(
      "/register",
    );
  });

  // Back, a stale bookmark, a shared link — RequireAuth only ever bounces the
  // other direction, so nothing else catches someone already signed in
  // landing here. Sent where a fresh sign-in would have gone, not to the grid
  // unconditionally, so a guard's own detour still resolves.
  it("sends an already signed-in visitor on to where they were headed, not to a form they can't use", () => {
    show("/login?next=%2Fshopping-list", signedIn);

    expect(screen.getByText("the list")).toBeDefined();
    expect(screen.queryByRole("textbox", { name: "Username" })).toBeNull();
  });

  it("sends an already signed-in visitor to the grid when there is nowhere else to go", () => {
    render(
      <AuthContext.Provider value={signedIn}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/" element={<p>the grid</p>} />
            <Route
              path="/login"
              element={
                <CredentialsForm
                  title="Sign in"
                  submitLabel="Sign in"
                  pendingLabel="Signing in…"
                  passwordAutoComplete="current-password"
                  action={noop}
                  alternate={{ to: "/register", label: "Need an account?" }}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByText("the grid")).toBeDefined();
  });
});
