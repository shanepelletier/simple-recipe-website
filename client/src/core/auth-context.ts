import { createContext, useContext } from "react";

import type { User } from "./models";

export interface AuthValue {
  user: User | null;
  /** False until the startup "who am I" call has answered, either way. */
  ready: boolean;
  /**
   * Whether there is no user because someone pressed Sign out, rather than
   * because they never signed in. RequireAuth has to tell those apart: one
   * asked to leave and wants the grid, the other tried to get in and wants the
   * sign-in form.
   *
   * Stays true until the next sign-in or page load, which is the behaviour we
   * want — someone who chose to sign out should keep landing on the grid, not
   * be handed a sign-in form for pressing Back.
   */
  justSignedOut: boolean;
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
