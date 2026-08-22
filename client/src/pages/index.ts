import { lazy } from "react";

// One chunk per page, the equivalent of Angular's loadComponent. <Suspense> in
// the shell covers the gap while a chunk downloads — a page-level placeholder,
// which is a different thing from the per-card skeletons the grid renders
// while its own data is in flight.
//
// These live here rather than beside the route table because oxlint's
// only-export-components rule requires a file exporting components to export
// nothing else, and the route table is not a component.

export const RecipeGrid = lazy(() => import("./RecipeGrid"));
export const RecipeDetail = lazy(() => import("./RecipeDetail"));
export const RecipeForm = lazy(() => import("./RecipeForm"));
export const ShoppingList = lazy(() => import("./ShoppingList"));
export const Login = lazy(() => import("./Login"));
export const Register = lazy(() => import("./Register"));
