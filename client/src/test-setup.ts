import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library registers this itself ONLY when vitest runs with
// `globals: true`. This project imports describe/it/expect explicitly
// instead, so it does not — and without it the DOM one test rendered is
// still on the page during the next one, which looks exactly like a
// component rendering when it shouldn't.
afterEach(cleanup);

// jsdom implements no media queries at all — `matchMedia` is simply absent, so
// anything that asks whether the reader wants less motion throws on its first
// render rather than getting an answer. Stubbed here rather than guarded at
// each call site, because the gap belongs to the test environment and not to
// the app: every real browser has had this for a decade.
//
// `matches: false` is the right default. It stands for "no preference set",
// which is what the great majority of readers have, so tests see the animated
// path unless one of them says otherwise.
window.matchMedia ??= (query: string) =>
  ({
    media: query,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
