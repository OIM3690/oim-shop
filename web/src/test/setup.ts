import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { closeApi, resetApi, server } from "./api-server";

// The first visit also loads lazy routes and the chart library.
configure({ asyncUtilTimeout: 5_000 });

// jsdom has no matchMedia; the sidebar asks it whether the screen is narrow.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) satisfies MediaQueryList;

// Recharts measures its container; jsdom has no layout, so give it a size.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => resetApi());
afterEach(() => {
  server.resetHandlers();
  cleanup();
  closeApi();
});
afterAll(() => server.close());
