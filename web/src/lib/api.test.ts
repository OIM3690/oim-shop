import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API } from "@/mocks/handlers";
import { server } from "@/mocks/server";
import { ApiError, api, PER_PAGE } from "./api";

function recordRequests() {
  const urls: URL[] = [];
  server.events.on("request:start", ({ request }) => urls.push(new URL(request.url)));
  return urls;
}

describe("api", () => {
  it("asks for one page of products with the filters it was given", async () => {
    const urls = recordRequests();
    const result = await api.products({ name: "ch", category: "1", page: 2 });

    const params = urls.at(-1)!.searchParams;
    expect(params.get("name")).toBe("ch");
    expect(params.get("category")).toBe("1");
    expect(params.get("page")).toBe("2");
    expect(params.get("per_page")).toBe(String(PER_PAGE));
    expect(result.pagination.total).toBe(4);
  });

  it("leaves out filters that are empty", async () => {
    const urls = recordRequests();
    await api.orders({ customer_id: "", employee_id: undefined, page: 1 });

    const params = urls.at(-1)!.searchParams;
    expect(params.has("customer_id")).toBe(false);
    expect(params.has("employee_id")).toBe(false);
  });

  it("returns an order with its lines", async () => {
    const order = await api.order(21646);
    expect(order.customer_name).toBe("IT");
    expect(order.lines).toHaveLength(order.line_count);
  });

  it("raises ApiError with the status when the API refuses", async () => {
    await expect(api.order(1)).rejects.toMatchObject({ status: 404 });
    await expect(api.order(1)).rejects.toBeInstanceOf(ApiError);
  });

  it("raises an error when a response does not have the expected shape", async () => {
    server.use(http.get(`${API}/products/:id`, () => HttpResponse.json({ product_id: "one" })));
    await expect(api.product(1)).rejects.toThrow();
  });
});
