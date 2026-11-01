import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { TEST_NOW } from "api/testing";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { closeApi, resetApi, server } from "./api-server";

// The API under test answers at a fixed moment, TEST_NOW in Boston, so the
// page's own clock is set to the same moment. Otherwise anything the page
// counts from today, such as the dashboard's month menus, drifts away from
// the API's figures as the calendar moves on. Only Date is faked; timers run.
vi.useFakeTimers({ toFake: ["Date"], now: new Date(`${TEST_NOW}-04:00`) });

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
