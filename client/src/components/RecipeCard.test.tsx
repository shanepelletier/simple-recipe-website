import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { RecipeCard as RecipeCardModel } from "../core/models";
import { RecipeCard } from "./RecipeCard";

const base: RecipeCardModel = {
  id: 1,
  name: "Classic Beef Chili",
  photo: null,
  rating: null,
  rating_count: 0,
  tags: [],
  owner: "alice",
  created_at: "2026-01-01T00:00:00+00:00",
};

// MemoryRouter is required, not optional: the card's <Link> throws outside a
// router, and the error ("useContext(...) is null") doesn't say so.
const show = (recipe: RecipeCardModel) =>
  render(
    <MemoryRouter>
      <RecipeCard recipe={recipe} />
    </MemoryRouter>,
  );

describe("RecipeCard", () => {
  it("says a recipe is unrated rather than rating it zero", () => {
    show(base);

    expect(screen.getByText(/not yet rated/i)).toBeDefined();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows the average and the count once there are reviews", () => {
    show({ ...base, rating: 4.5, rating_count: 2 });

    expect(screen.getByText(/4\.5/)).toBeDefined();
    expect(screen.getByText(/2/)).toBeDefined();
    expect(screen.queryByText(/not yet rated/i)).toBeNull();
  });

  it("renders a placeholder instead of a broken image when there is no photo", () => {
    show(base);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows the photo with the recipe name as its alt text", () => {
    show({ ...base, photo: "/media/recipes/abc.jpg" });

    const image = screen.getByRole("img");
    expect(image.getAttribute("src")).toBe("/media/recipes/abc.jpg");
    expect(image.getAttribute("alt")).toBe("Classic Beef Chili");
  });

  it("links to its own detail page", () => {
    show(base);

    expect(screen.getByRole("link").getAttribute("href")).toBe("/recipes/1");
  });

  it("renders the tags the server sent, in the order it sent them", () => {
    // The server already caps this at three and orders alphabetically, so the
    // card must not re-sort: a second opinion here can disagree with the
    // detail page about which three a recipe has.
    show({
      ...base,
      tags: [
        { id: 3, name: "quick" },
        { id: 1, name: "vegan" },
      ],
    });

    expect(screen.getAllByRole("listitem").map((tag) => tag.textContent)).toEqual([
      "quick",
      "vegan",
    ]);
  });
});
