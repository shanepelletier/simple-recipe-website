import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { CredentialsForm } from "./CredentialsForm";

// Only the `next` handling is under test here, so the action never runs.
const noop = async () => {};

function show(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <CredentialsForm
        title="Sign in"
        submitLabel="Sign in"
        pendingLabel="Signing in…"
        passwordAutoComplete="current-password"
        action={noop}
        alternate={{ to: "/register", label: "Need an account?" }}
      />
    </MemoryRouter>,
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
});
