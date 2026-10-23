import { screen, within } from "@testing-library/react";
import { server } from "@/mocks/server";

/** The body rows of the only table on the page. */
export const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

/** Collects the URLs of requests to one oim-api path, such as "/orders". */
export function recordRequests(path: string) {
  const urls: URL[] = [];
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === `/shop${path}`) urls.push(url);
  });
  return urls;
}
