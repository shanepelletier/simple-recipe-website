import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library registers this itself ONLY when vitest runs with
// `globals: true`. This project imports describe/it/expect explicitly
// instead, so it does not — and without it the DOM one test rendered is
// still on the page during the next one, which looks exactly like a
// component rendering when it shouldn't.
afterEach(cleanup);
