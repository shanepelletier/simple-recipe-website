import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, asApiError, get, post } from "./client";

function respondWith(body: unknown, init: ResponseInit = {}) {
  // Typing the mock as `typeof fetch` is what makes mock.calls[0][1] a
  // RequestInit instead of an empty tuple.
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        ...init,
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastInit(fetchMock: ReturnType<typeof respondWith>): RequestInit {
  return fetchMock.mock.calls[0][1]!;
}

function headersOf(fetchMock: ReturnType<typeof respondWith>): Record<string, string> {
  return lastInit(fetchMock).headers as Record<string, string>;
}

/** Runs a request that must fail, and hands back the ApiError it produced. */
async function failureFrom(run: () => Promise<unknown>): Promise<ApiError> {
  try {
    await run();
  } catch (reason) {
    return asApiError(reason);
  }
  throw new Error("Expected the request to fail, but it succeeded.");
}

beforeEach(() => {
  document.cookie = "csrftoken=tok-123";
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

describe("csrf", () => {
  it("sends the csrftoken cookie as an X-CSRFToken header on writes", async () => {
    const fetchMock = respondWith({ ok: true });

    await post("/api/recipes/", { name: "Chili" });

    expect(headersOf(fetchMock)["X-CSRFToken"]).toBe("tok-123");
  });

  it("does not send the header on reads", async () => {
    const fetchMock = respondWith({ ok: true });

    await get("/api/recipes/");

    expect(lastInit(fetchMock).headers).not.toHaveProperty("X-CSRFToken");
  });

  it("finds the token among other cookies", async () => {
    document.cookie = "sessionid=abc";
    document.cookie = "other=zzz";
    const fetchMock = respondWith({ ok: true });

    await post("/api/recipes/", {});

    expect(headersOf(fetchMock)["X-CSRFToken"]).toBe("tok-123");
  });

  it("sends an empty header rather than throwing when the cookie is missing", async () => {
    document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    const fetchMock = respondWith({ ok: true });

    await post("/api/recipes/", {});

    // Django will answer 403, which is the correct outcome — the request must
    // still be made, so the failure is the server's to explain.
    expect(headersOf(fetchMock)["X-CSRFToken"]).toBe("");
  });
});

describe("encoding", () => {
  it("sends a JSON payload as a JSON string", async () => {
    const fetchMock = respondWith({ ok: true });

    await post("/api/recipes/", { name: "Chili" });

    expect(headersOf(fetchMock)["Content-Type"]).toBe("application/json");
    expect(lastInit(fetchMock).body).toBe('{"name":"Chili"}');
  });

  it("never sets Content-Type for FormData, so the browser adds the boundary", async () => {
    const fetchMock = respondWith({ ok: true });
    const form = new FormData();
    form.append("photo", new File(["x"], "photo.jpg"));

    await post("/api/recipes/1/photo/", form);

    const init = lastInit(fetchMock);
    expect(init.headers).not.toHaveProperty("Content-Type");
    expect(init.body).toBe(form);
  });

  it("sends the session cookie", async () => {
    const fetchMock = respondWith({ ok: true });

    await get("/api/auth/me/");

    expect(lastInit(fetchMock).credentials).toBe("same-origin");
  });
});

describe("errors", () => {
  it("throws an ApiError carrying the status and the fields map", async () => {
    respondWith(
      { error: "Please correct the errors below.", fields: { name: ["Required."] } },
      { status: 400 },
    );

    const failure = await failureFrom(() => post("/api/recipes/", {}));

    expect(failure.status).toBe(400);
    expect(failure.message).toBe("Please correct the errors below.");
    expect(failure.fields).toEqual({ name: ["Required."] });
  });

  it("survives an HTML error page instead of the JSON envelope", async () => {
    respondWith("<html>Django debug page</html>", { status: 500 });

    const failure = await failureFrom(() => get("/api/recipes/1/"));

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.status).toBe(500);
    expect(failure.fields).toEqual({});
  });

  it("turns a network failure into status 0 with a readable message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const failure = await failureFrom(() => get("/api/recipes/"));

    expect(failure.status).toBe(0);
    expect(failure.message).toMatch(/reach the server/);
  });
});
