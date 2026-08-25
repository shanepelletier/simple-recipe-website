import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Recipe, RecipeIngredient, Tag, UnitGroup } from "../core/models";
import RecipeForm from "./RecipeForm";

const unitGroups: UnitGroup[] = [
  {
    category: "mass",
    label: "Mass",
    units: [
      {
        id: 1,
        name: "pound",
        plural: "pounds",
        abbreviation: "lb",
        category: "mass",
        takes_of: true,
      },
    ],
  },
];

const tags: Tag[] = [
  { id: 1, name: "quick" },
  { id: 2, name: "vegan" },
  { id: 3, name: "vegetarian" },
];

const ingredient = (id: number, name: string, quantity: string): RecipeIngredient => ({
  id,
  ingredient: { id, name, plural: `${name}s` },
  unit: unitGroups[0].units[0],
  quantity,
  display: `${quantity} pounds of ${name}`,
  position: id,
});

const stored: Recipe = {
  id: 9,
  name: "Chili",
  photo: null,
  rating: null,
  rating_count: 0,
  tags: [],
  owner: "alice",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ingredients: [],
  steps: [],
  version: 1,
  copied_from_id: null,
  copied_from_username: "",
  can_edit: true,
  user_rating: null,
};

/** A recipe with enough in it to be saved again untouched, which is what the
 *  tests about one control need so they can leave the rest alone. */
const filled: Recipe = {
  ...stored,
  ingredients: [ingredient(1, "beef", "2"), ingredient(2, "onion", "1")],
  steps: [
    { id: 1, text: "Brown the beef", position: 1 },
    { id: 2, text: "Add the onion", position: 2 },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Every request the form made, in order — the order is half of what is
 *  being asserted here. */
let calls: string[] = [];
/** The JSON bodies it sent, for the assertions that are about what was in
 *  them rather than which endpoint took them. */
let sent: Record<string, unknown>[] = [];
let photoUploadFails = false;
// Set by the test that wants to look at the form while the upload is still in
// flight. Nothing else can tell an upload that finishes before the navigation
// from one that finishes after it.
let holdUpload = false;
let releaseUpload: () => void = () => {};

function stubServer(recipe: Recipe | null) {
  calls = [];
  sent = [];
  photoUploadFails = false;
  holdUpload = false;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      calls.push(`${method} ${url}`);
      if (typeof init.body === "string") {
        sent.push(JSON.parse(init.body) as Record<string, unknown>);
      }

      if (url.startsWith("/api/units/")) {
        return json({ groups: unitGroups });
      }
      if (url.startsWith("/api/tags/")) {
        return json({ results: tags });
      }
      if (url.startsWith("/api/ingredients/")) {
        return json({ results: [] });
      }
      if (url.endsWith("/photo/")) {
        if (holdUpload) {
          await new Promise<void>((resolve) => (releaseUpload = resolve));
        }
        return photoUploadFails
          ? // The shape model validation produces: the useful sentence is in
            // fields.photo, never in the top-level message.
            json(
              {
                error: "Please correct the errors below.",
                fields: { photo: ["Image must be smaller than 5 MB."] },
              },
              400,
            )
          : json({ photo: "/media/recipes/new.jpg" });
      }
      if (method === "POST") {
        return json({ recipe: { ...stored, ...recipe } });
      }
      return json({ recipe: { ...stored, ...recipe, version: 2 } });
    }),
  );
}

function show(path: string, recipe: Recipe | null = null) {
  stubServer(recipe);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/recipes/new" element={<RecipeForm />} />
        <Route path="/recipes/:id/edit" element={<RecipeForm />} />
        <Route path="/recipes/:id" element={<h1>Recipe page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

const image = (name: string) => new File(["x"], name, { type: "image/jpeg" });
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));
const choose = (label: string, file: File) =>
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });

/** Fills in the least a recipe can be saved with. */
async function fillForm() {
  fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Chili" } });
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Ingredient"), { target: { value: "beef" } });
  // By its label like every other box here. The numeral beside a step box is
  // not a label for it, so the box names itself — and reaching it this way is
  // what keeps that true.
  fireEvent.change(screen.getByLabelText("Step 1"), { target: { value: "Brown the beef" } });
}

beforeEach(() => {
  // jsdom implements neither, and the preview is built from a blob URL.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

describe("RecipeForm rows", () => {
  it("names the row each control acts on, rather than counting rows", async () => {
    show("/recipes/9/edit", filled);

    // What a control says out loud is the only thing distinguishing it from
    // the identical marks around it, so it says which row it belongs to.
    expect(await screen.findByRole("button", { name: "Reorder beef" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Remove onion" })).toBeDefined();
    // A step has no content of its own to name, so it falls back to its number.
    expect(screen.getByRole("button", { name: "Reorder step 1" })).toBeDefined();
  });

  it("offers no way to empty the list", async () => {
    show("/recipes/9/edit", filled);

    await screen.findByLabelText("Name");
    fireEvent.click(screen.getByRole("button", { name: "Remove onion" }));

    // A recipe with no ingredients at all is not a state the form offers.
    expect(
      (screen.getByRole("button", { name: "Remove beef" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("RecipeForm tags", () => {
  const tagged: Recipe = { ...filled, tags: [tags[0]] };

  it("carries the tags a recipe already has, and saves ids for what it ends with", async () => {
    show("/recipes/9/edit", tagged);

    // The field speaks in names because that is what it shows; the request
    // carries ids, and this is the seam where the two have to agree.
    expect(await screen.findByRole("button", { name: "Remove quick" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Remove quick" }));
    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "vegan" } });
    fireEvent.click(screen.getByRole("button", { name: "vegan" }));

    // Nothing else touched: this recipe already has everything a save needs.
    save();

    await waitFor(() => expect(calls).toContain("PATCH /api/recipes/9/"));
    expect(sent[sent.length - 1].tags).toEqual([2]);
  });

  it("stops offering tags at the cap instead of letting the server refuse a sixth", async () => {
    show("/recipes/9/edit", { ...stored, tags });

    // Three of five, so there is still room and the box still takes a caret.
    expect((await screen.findByLabelText("Tags")).getAttribute("disabled")).toBeNull();
    expect(screen.getByText("3 of 5 tags chosen.")).toBeDefined();
  });
});

describe("RecipeForm photos", () => {
  it("uploads the photo once the recipe exists, and waits for it before leaving", async () => {
    show("/recipes/new");
    await fillForm();
    choose("Add a photo", image("photo.jpg"));
    holdUpload = true;

    expect(screen.getByAltText("Selected photo")).toBeDefined();

    save();

    // Create first: the photo endpoint needs an id to upload against.
    await waitFor(() => expect(calls).toContain("POST /api/recipes/9/photo/"));
    expect(calls.filter((call) => call.includes("/api/recipes/"))).toEqual([
      "POST /api/recipes/",
      "POST /api/recipes/9/photo/",
    ]);

    // Still here while the upload is in flight. Leaving now would land on a
    // recipe page that shows no photo, and the user would go back to add it.
    expect(screen.queryByText("Recipe page")).toBeNull();

    releaseUpload();

    expect(await screen.findByText("Recipe page")).toBeDefined();
  });

  it("says the recipe survived when only the photo failed", async () => {
    show("/recipes/new");
    await fillForm();
    choose("Add a photo", image("photo.jpg"));
    photoUploadFails = true;

    save();

    // Without this distinction the user reads "couldn't save", concludes the
    // recipe is gone, and types the whole thing again.
    expect(await screen.findByText(/Recipe saved, but the photo/)).toBeDefined();
    expect(screen.getByText("Image must be smaller than 5 MB.")).toBeDefined();
    expect(screen.queryByText("Recipe page")).toBeNull();
  });

  it("updates the recipe it just created rather than creating a second one", async () => {
    show("/recipes/new");
    await fillForm();
    choose("Add a photo", image("photo.jpg"));
    photoUploadFails = true;

    save();
    await screen.findByText(/Recipe saved, but the photo/);
    photoUploadFails = false;
    save();

    expect(await screen.findByText("Recipe page")).toBeDefined();
    // The second save is a PATCH: the form is still on screen, but the recipe
    // it is editing is no longer hypothetical.
    expect(calls.filter((call) => call.includes("/api/recipes/"))).toEqual([
      "POST /api/recipes/",
      "POST /api/recipes/9/photo/",
      "PATCH /api/recipes/9/",
      "POST /api/recipes/9/photo/",
    ]);
  });

  it("refuses a file the server would refuse, without uploading it", async () => {
    show("/recipes/new");
    await fillForm();

    choose("Add a photo", image("clip.gif"));

    expect(screen.getByText("Image must be a JPG, PNG, or WebP file.")).toBeDefined();
    expect(screen.queryByAltText("Selected photo")).toBeNull();

    save();

    expect(await screen.findByText("Recipe page")).toBeDefined();
    expect(calls.filter((call) => call.includes("/photo/"))).toEqual([]);
  });

  it("drops a file that only claims to be an image", async () => {
    show("/recipes/new");
    await fillForm();
    choose("Add a photo", image("renamed.jpg"));

    // The preview failing to decode is the browser making the same judgement
    // Pillow makes on the server, before anything has been saved.
    fireEvent.error(screen.getByAltText("Selected photo"));

    expect(screen.getByText("Upload a valid image file.")).toBeDefined();
    expect(screen.queryByAltText("Selected photo")).toBeNull();
  });

  it("shows the photo a recipe already has, and offers to replace it", async () => {
    show("/recipes/9/edit", { ...stored, photo: "/media/recipes/old.jpg" });

    expect((await screen.findByAltText("Current photo")).getAttribute("src")).toBe(
      "/media/recipes/old.jpg",
    );

    choose("Replace photo", image("new.jpg"));

    // One photo at a time, showing what saving would do.
    expect(screen.queryByAltText("Current photo")).toBeNull();
    expect(screen.getByAltText("Selected photo")).toBeDefined();
    // Not "Remove": nothing in the API deletes a stored photo, so all this
    // button can do is undo the choice.
    expect(screen.getByRole("button", { name: "Keep the current photo" })).toBeDefined();
  });
});

describe("RecipeForm validation", () => {
  it("points an invalid field at the message that explains why, not just that it is invalid", async () => {
    show("/recipes/new");
    // Everything but the name, so this is the one problem submitting reports.
    fireEvent.change(await screen.findByLabelText("Quantity"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Ingredient"), { target: { value: "beef" } });
    fireEvent.change(screen.getByLabelText("Step 1"), { target: { value: "Brown the beef" } });

    save();

    const nameInput = screen.getByLabelText("Name");
    expect(nameInput.getAttribute("aria-invalid")).toBe("true");
    // aria-invalid alone says something is wrong; a screen reader visiting
    // this field later, not just at the moment the alert fires, needs
    // aria-describedby to say what — and it has to name a real id, not a
    // guess at one the error list might use.
    const describedBy = nameInput.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      "Give the recipe a name.",
    );
  });
});
