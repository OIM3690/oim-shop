import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        // A network failure or a server error is tried once more. A 404 or a
        // 429 is an answer, and asking again at once would not change it.
        retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 1,
      },
    },
  });
}
