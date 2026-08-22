import type { ReactElement } from "react";
import { Navigate } from "react-router";

import { Login, RecipeDetail, RecipeForm, RecipeGrid, Register, ShoppingList } from "../pages";

export interface AppRoute {
  path: string;
  element: ReactElement;
  /** Whether an anonymous visitor is bounced to /login. */
  guarded: boolean;
}

// The route table is data rather than JSX so that it can be swept: the tests
// enumerate it and require every route to be guarded unless it is named in a
// short list of public exceptions. A hand-written list of routes *to check*
// would be just as easy to forget as the guard itself — which is the same
// reasoning behind the server's API permission sweep.
//
// Declaration order is irrelevant. React Router ranks by specificity, so
// /recipes/new outranks /recipes/:id wherever it sits; Angular would have
// matched top to bottom and read "new" as an id.
export const ROUTES: AppRoute[] = [
  { path: "/", element: <RecipeGrid />, guarded: false },
  { path: "/recipes/new", element: <RecipeForm />, guarded: true },
  { path: "/recipes/:id", element: <RecipeDetail />, guarded: false },
  { path: "/recipes/:id/edit", element: <RecipeForm />, guarded: true },
  { path: "/shopping-list", element: <ShoppingList />, guarded: true },
  { path: "/login", element: <Login />, guarded: false },
  { path: "/register", element: <Register />, guarded: false },
  // In the table rather than beside it, so nothing sits outside the sweep.
  { path: "*", element: <Navigate to="/" replace />, guarded: false },
];
