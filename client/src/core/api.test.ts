import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addComment, recipes, updateRecipe } from "./api";

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response("{}", {
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "csrftoken=tok";
});

afterEach(() => vi.unstubAllGlobals());

const calledUrl = () => String(fetchMock.mock.calls[0][0]);
const calledMethod = () => (fetchMock.mock.calls[0][1] as RequestInit).method;

describe("queryString", () => {
  it("drops empty and undefined values", async () => {
    await recipes({ search: "", tag: "vegan", sort: undefined });

    expect(calledUrl()).toBe("/api/recipes/?tag=vegan");
  });

  it('leaves no trailing "?" when every filter is empty', async () => {
    await recipes({});

    expect(calledUrl()).toBe("/api/recipes/");
  });

  it("encodes values that need it", async () => {
    await recipes({ search: "beef & rice" });

    expect(calledUrl()).toBe("/api/recipes/?search=beef+%26+rice");
  });

  it("keeps repeated calls independent", async () => {
    await recipes({ tag: "vegan" });
    await recipes({});

    expect(String(fetchMock.mock.calls[1][0])).toBe("/api/recipes/");
  });
});

describe("endpoints", () => {
  it("updates a recipe with PATCH on its own URL", async () => {
    await updateRecipe(7, { name: "Chili", tags: [], ingredients: [], steps: [], version: 3 });

    expect(calledUrl()).toBe("/api/recipes/7/");
    expect(calledMethod()).toBe("PATCH");
  });

  it("sends the version the server needs to detect a stale edit", async () => {
    await updateRecipe(7, { name: "Chili", tags: [], ingredients: [], steps: [], version: 3 });

    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    expect(JSON.parse(body).version).toBe(3);
  });

  it("posts a comment as multipart with the photo attached", async () => {
    const photo = new File(["x"], "photo.jpg");

    await addComment(7, "Lovely", photo);

    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
    expect(calledUrl()).toBe("/api/recipes/7/comments/");
    expect(body.get("body")).toBe("Lovely");
    expect(body.get("photo")).toBe(photo);
  });

  it("omits the photo entirely when there isn't one", async () => {
    await addComment(7, "Lovely");

    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
    expect(body.has("photo")).toBe(false);
  });
});
