import { Suspense } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router";

import { RequireAuth } from "./core/RequireAuth";
import { useAuth } from "./core/auth-context";
import { returnTo, withNext } from "./core/next";
import { ROUTES } from "./core/routes";

function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Signing in from the header is not a decision to go to the grid — it is a
  // decision to be signed in, made while standing on some page you meant to
  // stay on.
  const next = returnTo(location);

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <header className="site-header">
      <nav className="site-nav">
        {/* <Link>/<NavLink>, never a bare <a href>: an anchor triggers a full
            page reload, which throws away the auth state and makes the app
            look broken. NavLink adds isActive for the current-page highlight.

            `end` on the "/" link is load-bearing: every path starts with "/",
            so without it the Recipes tab stays marked as the current page
            while you are standing on the shopping list. */}
        <NavLink to="/" end>
          Recipes
        </NavLink>
        {user !== null && (
          <>
            <NavLink to="/recipes/new">New recipe</NavLink>
            <NavLink to="/shopping-list">Shopping list</NavLink>
          </>
        )}
      </nav>
      <div className="site-user">
        {user === null ? (
          <>
            <Link to={withNext("/login", next)}>Sign in</Link>
            <Link to={withNext("/register", next)}>Register</Link>
          </>
        ) : (
          <>
            <span className="site-user__name">{user.username}</span>
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const { ready } = useAuth();

  // Nothing routes until we know whether there is a session, or a deep link
  // in a fresh tab bounces a signed-in user to /login.
  if (!ready) {
    return null;
  }

  return (
    <>
      <Header />
      <main>
        <Suspense fallback={<p>Loading…</p>}>
          <Routes>
            {ROUTES.map(({ path, element, guarded }) => (
              <Route
                key={path}
                path={path}
                element={guarded ? <RequireAuth>{element}</RequireAuth> : element}
              />
            ))}
          </Routes>
        </Suspense>
      </main>
    </>
  );
}
