import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./client";
import { useApi } from "./useApi";

/** A promise whose resolution this test controls, so responses can be ordered. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useApi", () => {
  it("ignores a response that lost the race", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const responses = [first.promise, second.promise];
    let call = 0;

    const { result, rerender } = renderHook(({ dep }) => useApi(() => responses[call++], [dep]), {
      initialProps: { dep: "a" },
    });

    rerender({ dep: "b" }); // the second request starts

    await act(async () => {
      second.resolve("second"); // …and answers first
    });
    await act(async () => {
      first.resolve("first"); // the stale one answers last, and must lose
    });

    expect(result.current.data).toBe("second");
    expect(result.current.loading).toBe(false);
  });

  it("refetches when a dependency changes", async () => {
    const load = vi.fn(async () => "ok");

    const { rerender } = renderHook(({ dep }) => useApi(load, [dep]), {
      initialProps: { dep: 1 },
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    rerender({ dep: 2 });

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it("does not refetch when a rerender changes nothing", async () => {
    const load = vi.fn(async () => "ok");

    const { rerender } = renderHook(({ dep }) => useApi(load, [dep]), {
      initialProps: { dep: 1 },
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    // `load` is a fresh closure every render in real callers, so this is the
    // half of the deps contract that would fail if it were in the array.
    rerender({ dep: 1 });

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("refetches on reload()", async () => {
    const load = vi.fn(async () => "ok");

    const { result } = renderHook(() => useApi(load, []));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    act(() => result.current.reload());

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it("folds each setData updater into the value the last one left", async () => {
    // Two writes in flight: both updaters were created before either landed,
    // so a caller passing values instead would overwrite the first with a copy
    // of the list from before it happened.
    const { result } = renderHook(() => useApi(async () => ["a"], []));
    await waitFor(() => expect(result.current.data).toEqual(["a"]));

    act(() => {
      result.current.setData((current) => [...current, "b"]);
      result.current.setData((current) => [...current, "c"]);
    });

    expect(result.current.data).toEqual(["a", "b", "c"]);
  });

  it("drops an update against a value that never loaded", async () => {
    // There is no current value to fold into, and a write cannot have
    // succeeded against a list that never arrived.
    const { result } = renderHook(() =>
      useApi<string>(async () => {
        throw new ApiError(500, { error: "Server error.", fields: {} });
      }, []),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());

    act(() => result.current.setData((current) => `${current}!`));

    expect(result.current.data).toBeNull();
  });

  it("records a failure and stops loading", async () => {
    const load = vi.fn(async () => {
      throw new ApiError(404, { error: "Not found.", fields: {} });
    });

    const { result } = renderHook(() => useApi(load, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.status).toBe(404);
    expect(result.current.data).toBeNull();
  });

  it("clears a previous failure when a retry succeeds", async () => {
    let shouldFail = true;
    const load = vi.fn(async () => {
      if (shouldFail) {
        throw new ApiError(500, { error: "Server error.", fields: {} });
      }
      return "ok";
    });

    const { result } = renderHook(() => useApi(load, []));
    await waitFor(() => expect(result.current.error?.status).toBe(500));

    shouldFail = false;
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.data).toBe("ok"));
    expect(result.current.error).toBeNull();
  });
});
