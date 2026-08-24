import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "../core/auth-context";
import type { AuthValue } from "../core/auth-context";
import type { RatingResponse } from "../core/models";
import { RatingWidget } from "./RatingWidget";

const noop = async () => {};
const signedIn: AuthValue = {
  ready: true,
  signIn: noop,
  signUp: noop,
  signOut: noop,
  user: { id: 1, username: "bob", is_staff: false, is_moderator: false },
};
const signedOut: AuthValue = { ...signedIn, user: null };

const response: RatingResponse = { rating: 3, recipe: { id: 7, rating: 3, rating_count: 1 } };

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

function show(userRating: number | null, auth: AuthValue = signedIn, average: number | null = 3) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <RatingWidget
          recipeId={7}
          average={average}
          count={2}
          userRating={userRating}
          onRated={() => {}}
        />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const star = (n: number) =>
  screen.getByRole("button", {
    name: (name) => name.includes(`${n} out of 5`),
  });
const request = () => fetchMock.mock.calls[0] as [string, RequestInit];

describe("RatingWidget", () => {
  it("rates a recipe you have not rated", async () => {
    show(null);

    star(4).click();

    const [url, init] = request();
    expect(String(url)).toBe("/api/recipes/7/review/");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ rating: 4 });
  });

  it("clears the rating when you click the star you already chose", async () => {
    // One character away from never clearing, and nothing else guards it:
    // there is deliberately no separate "remove my rating" control.
    show(4);

    star(4).click();

    expect(request()[1].method).toBe("DELETE");
  });

  it("changes the rating when you click a different star", async () => {
    show(4);

    star(2).click();

    const [, init] = request();
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ rating: 2 });
  });

  it("draws the average as a fraction of the row rather than rounding it", () => {
    show(null, signedIn, 4.5);

    // 4.5 of 5 is 90%, i.e. clipped halfway through the fifth star. Rounding
    // would contradict the "4.5" printed directly underneath.
    expect(document.querySelector<HTMLElement>(".rating__average")?.style.width).toBe("90%");
  });

  it("draws no average at all for an unrated recipe", () => {
    show(null, signedIn, null);

    expect(document.querySelector<HTMLElement>(".rating__average")?.style.width).toBe("0%");
    expect(screen.getByText(/not yet rated/i)).toBeDefined();
  });

  it("offers no stars to a signed-out reader, and a way to sign in", () => {
    show(null, signedOut);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeDefined();
  });

  it("states both numbers in words, since colour alone cannot carry them", () => {
    show(2);

    expect(screen.getByText("3 average from 2 ratings · you rated 2")).toBeDefined();
  });
});
