import * as api from "./api";
import { useApi } from "./useApi";

let pending: ReturnType<typeof api.units> | null = null;

/**
 * The unit list, fetched at most once per page load.
 *
 * The recipe form renders one quantity control per ingredient row, so without
 * this a recipe with eight ingredients issues eight identical
 * GET /api/units/ calls on mount. Caching the *promise* rather than the result
 * means rows mounting in the same tick share one request instead of each
 * starting its own.
 *
 * Units are admin-curated and change approximately never, so there is no
 * invalidation beyond a page reload. A failure does clear the cache, though —
 * otherwise one bad response would poison every later attempt for the life of
 * the tab, and a retry would do nothing.
 */
function loadUnits() {
  pending ??= api.units().catch((reason: unknown) => {
    pending = null;
    throw reason;
  });
  return pending;
}

export function useUnits() {
  return useApi(loadUnits, []);
}
