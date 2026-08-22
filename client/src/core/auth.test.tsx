import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./auth";
import { useAuth } from "./auth-context";

function Probe() {
  const { user, ready } = useAuth();
  return <p>{ready ? `ready:${user?.username ?? "anonymous"}` : "waiting"}</p>;
}

function respondWith(response: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(response));
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  document.cookie = "csrftoken=tok";
});

afterEach(() => vi.unstubAllGlobals());

describe("AuthProvider", () => {
  it("reports the signed-in user once the startup call answers", async () => {
    respondWith(async () => json({ user: { id: 1, username: "alice" } }));

    await waitFor(() => expect(screen.getByText("ready:alice")).toBeDefined());
  });

  it("becomes ready even when the startup call fails", async () => {
    // The failure mode this exists to prevent: if `ready` were only set on
    // success, an unreachable server would leave it false forever and the
    // shell — which renders nothing until ready — would show a blank page
    // with no error and no way out.
    respondWith(async () => {
      throw new TypeError("Failed to fetch");
    });

    await waitFor(() => expect(screen.getByText("ready:anonymous")).toBeDefined());
  });
});
