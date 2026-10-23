import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAppRouter } from "@/router";

/** Renders the whole app at a path such as "/orders?country=Germany". */
export function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const history = createMemoryHistory({
    initialEntries: [import.meta.env.BASE_URL.replace(/\/$/, "") + path],
  });
  const router = createAppRouter(queryClient, history);
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const location = () => router.state.location;
  return { router, user, location };
}
