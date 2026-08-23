import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "../core/auth-context";
import type { AuthValue } from "../core/auth-context";
import type { Comment } from "../core/models";
import { CommentList } from "./CommentList";

const signedIn: AuthValue = {
  ready: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  user: { id: 1, username: "alice", is_staff: false, is_moderator: false },
};

const posted: Comment = {
  id: 3,
  body: "Made this twice.",
  photo: null,
  author: "alice",
  created_at: "2026-01-01T00:00:00Z",
  can_delete: true,
};

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(async (_url, init) =>
    (init?.method ?? "GET") === "GET"
      ? json({ results: [], page: 1, pages: 1, total: 0 })
      : json({ comment: posted }),
  );
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

async function show() {
  render(
    <AuthContext.Provider value={signedIn}>
      <MemoryRouter>
        <CommentList recipeId={7} />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return await screen.findByLabelText("Attach photo");
}

const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

describe("CommentList photos", () => {
  it("refuses a file the server would refuse, in the same words as the recipe form", async () => {
    const input = await show();

    fireEvent.change(input, { target: { files: [new File(["x"], "clip.gif")] } });

    expect(screen.getByText("Image must be a JPG, PNG, or WebP file.")).toBeDefined();
    expect(screen.queryByAltText("Selected attachment")).toBeNull();
  });

  it("attaches an accepted photo to the comment", async () => {
    const input = await show();

    fireEvent.change(input, { target: { files: [new File(["x"], "photo.jpg")] } });
    fireEvent.change(screen.getByLabelText("Add a comment"), {
      target: { value: "Made this twice." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));

    await screen.findByText("Made this twice.");
    const body = posts()[0][1]?.body as FormData;
    expect((body.get("photo") as File).name).toBe("photo.jpg");
  });

  it("drops a file that only claims to be an image", async () => {
    const input = await show();

    fireEvent.change(input, { target: { files: [new File(["x"], "renamed.jpg")] } });
    fireEvent.error(screen.getByAltText("Selected attachment"));

    expect(screen.getByText("Upload a valid image file.")).toBeDefined();
    expect(screen.queryByAltText("Selected attachment")).toBeNull();
  });
});
