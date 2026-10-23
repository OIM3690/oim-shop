import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createQueryClient } from "./lib/query-client";
import { createAppRouter } from "./router";

async function start() {
  // The end-to-end tests build the site with VITE_API_MOCK=true, which answers
  // every oim-api request from recorded data. A normal build leaves this out.
  if (import.meta.env.VITE_API_MOCK === "true") {
    const { worker } = await import("./mocks/browser");
    await worker.start({
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
      onUnhandledFrame: "bypass",
      quiet: true,
    });
  }

  const queryClient = createQueryClient();
  const router = createAppRouter(queryClient);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void start();
