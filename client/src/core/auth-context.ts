import { createContext, useContext } from "react";

import type { User } from "./models";

export interface AuthValue {
  user: User | null;
  /** False until the startup "who am I" call has answered, either way. */
  ready: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Exported rather than kept private so a test can render a component under a
// chosen auth state without standing up the provider and mocking fetch.
export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return value;
}
