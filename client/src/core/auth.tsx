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

  const signIn = useCallback(async (username: string, password: string) => {
    setUser((await api.login(username, password)).user);
  }, []);

  const signUp = useCallback(async (username: string, password: string) => {
    setUser((await api.register(username, password)).user);
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signOut }),
    [user, ready, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
