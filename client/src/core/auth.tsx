import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as api from "./api";
import { AuthContext } from "./auth-context";
import type { User } from "./models";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Runs once. This is also what makes Django set the csrftoken cookie: GET
  // /api/auth/me/ carries @ensure_csrf_cookie, so every write after this has
  // a token to send.
  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  // Set by signing out and cleared by signing in, so that "no user" can be
  // read as either "left" or "never arrived". Without it the two are the same
  // state, and the route guard has to guess which one it is looking at.
  const [justSignedOut, setJustSignedOut] = useState(false);

  const signIn = useCallback(async (username: string, password: string) => {
    setUser((await api.login(username, password)).user);
    setJustSignedOut(false);
  }, []);

  const signUp = useCallback(async (username: string, password: string) => {
    setUser((await api.register(username, password)).user);
    setJustSignedOut(false);
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
    setJustSignedOut(true);
  }, []);

  const value = useMemo(
    () => ({ user, ready, justSignedOut, signIn, signUp, signOut }),
    [user, ready, justSignedOut, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
