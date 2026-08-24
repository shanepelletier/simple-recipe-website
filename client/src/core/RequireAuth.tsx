import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router";

import { useAuth } from "./auth-context";
import { withNext } from "./next";

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
    //
    // Not returnTo(): a guarded page is never the grid and never a credentials
    // page, so there is always a destination here, and null would mean the
    // guard silently forgot one.
    return <Navigate to={withNext("/login", location.pathname + location.search)} replace />;
  }
  return children;
}
