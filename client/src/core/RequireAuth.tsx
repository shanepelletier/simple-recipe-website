import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router";

import { useAuth } from "./auth-context";

// Reads state rather than making a request: this runs on every navigation, and
// an HTTP call here would make routing feel slow and could race. The
// provider's one startup call fills the state; the guard is then synchronous.
export function RequireAuth({ children }: { children: ReactElement }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  // A deep link in a fresh tab would otherwise run this before the startup
  // call resolves and bounce a signed-in user to /login. The shell gates on
  // `ready` too; this is what makes the guard safe in isolation.
  if (!ready) {
    return null;
  }
  if (user === null) {
    // Remember where they were headed so login can send them back. `replace`
    // keeps the bounce out of history — without it, Back returns to the
    // guarded page and bounces again.
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}
