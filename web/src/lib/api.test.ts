import { describe, expect, it } from "vitest";
import { recordRequests } from "@/test/helpers";
import { api, ApiError, PER_PAGE } from "./api";

describe("api", () => {
  it("asks for one page with the filters it was given, and leaves out empty ones", async () => {
    const urls = recordRequests("/products");
    const result = await api.products({ name: "ch", category: 1, page: 1, sort: undefined });
    const params = urls.at(-1)!.searchParams;
    expect(params.get("name")).toBe("ch");
    expect(params.get("category")).toBe("1");
    expect(params.get("per_page")).toBe(String(PER_PAGE));
    expect(params.has("sort")).toBe(false);
    expect(result.pagination.total).toBe(4);
  });

  it("raises ApiError with the status and the server's message", async () => {
    const error = await api.order(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: "No order 1" });
  });

  it("keeps the fields the server named when it refused a write", async () => {
    // Signed out, a write is refused before any field is checked.
    const error = await api.setDisplayName("Ana").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 401, issues: [] });
  });
});
