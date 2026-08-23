import { useCallback, useEffect, useState } from "react";

import { asApiError } from "./client";
import type { ApiError } from "./client";

export interface Loaded<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
  /**
   * For updating the loaded value in place after a successful write.
   *
   * Takes an updater as well as a value, because two writes can be in flight
   * at once: a caller that computes the next value from the render it started
   * in would fold the second response into a list that predates the first, and
   * quietly undo it. An updater always folds into what is there now.
   */
  setData: (next: T | ((current: T) => T)) => void;
}

export function useApi<T>(load: () => Promise<T>, deps: unknown[]): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // The whole point of this hook. Typing in the search box fires a request
    // per navigation; without this flag a slow early response can land after
    // a fast later one and overwrite the newer results with older ones.
    let current = true;

    setLoading(true);
    setError(null);

    load().then(
      (value) => {
        if (current) {
          setData(value);
          setLoading(false);
        }
      },
      (reason: unknown) => {
        if (current) {
          setError(asApiError(reason));
          setLoading(false);
        }
      },
    );

    return () => {
      current = false;
    };

    // The only lint suppression in the project. It covers three warnings on
    // this one effect, all of them the design rather than a mistake:
    //
    //   - `load` is missing from the deps. It is a fresh closure on every
    //     render, so including it would re-fetch forever. The caller declares
    //     what the request actually depends on, which is the contract here.
    //   - `[...deps, attempt]` is a "complex expression" oxlint can't read
    //     statically. It can't: the array comes from the caller.
    //   - `setLoading(true)` trips react/set-state-in-effect, a rule aimed at
    //     values derivable during render. This is synchronizing with an
    //     external system, which the rule's own help text carves out.
    //
    // The third is silenced by this same comment rather than one of its own:
    // oxlint stops running set-state-in-effect on an effect whose
    // exhaustive-deps warning is suppressed. Worth knowing, because a
    // separate react/set-state-in-effect suppression here would look
    // load-bearing and be dead.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const update = useCallback((next: T | ((current: T) => T)) => {
    if (typeof next !== "function") {
      setData(next);
      return;
    }
    // The cast is the price of T being unconstrained: TypeScript cannot rule
    // out a T that is itself a function, so it will not narrow this on typeof.
    const fold = next as (current: T) => T;
    // A null current means nothing ever loaded, and a write cannot have
    // succeeded against a value that never arrived — so there is nothing to
    // fold into and the update is dropped rather than inventing a value.
    setData((current) => (current === null ? null : fold(current)));
  }, []);

  return { data, loading, error, reload, setData: update };
}
