import { Suspense } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router";

import { RequireAuth } from "./core/RequireAuth";
import { useAuth } from "./core/auth-context";
import { ROUTES } from "./core/routes";

function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <header>
      <nav>
        {/* <Link>/<NavLink>, never a bare <a href>: an anchor triggers a full
            page reload, which throws away the auth state and makes the app
            look broken. NavLink adds isActive for the current-page highlight. */}
        <NavLink to="/">Recipes</NavLink>
        {user !== null && (
          <>
            <NavLink to="/recipes/new">New recipe</NavLink>
            <NavLink to="/shopping-list">Shopping list</NavLink>
          </>
        )}
      </nav>
      <div>
        {user === null ? (
          <>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Register</Link>
          </>
        ) : (
          <>
            <span>{user.username}</span>
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
