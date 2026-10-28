import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar, SearchField, SelectField } from "@/components/filters";
import { PageHeader } from "@/components/page-header";
import { productColumns } from "@/components/product-columns";
import { Pager } from "@/components/pager";
import { EmptyState, ErrorState, LoadingRows, PastTheEnd } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { categoriesQuery, optionsFailed, productsQuery } from "@/lib/queries";
import { cleanSearch } from "@/lib/search";
import { sortParam } from "@/lib/sorting";

const searchSchema = z.object({
  name: z.string().optional().catch(undefined),
  category: z.number().int().positive().optional().catch(undefined),
  sort: sortParam(["name", "unit_price", "units_in_stock", "revenue"] as const),
  page: z.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/products/")({
  validateSearch: searchSchema,
  component: ProductsPage,
});

function ProductsPage() {
  const { name, category, sort, page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const products = useQuery(productsQuery({ name, category, sort, page }));
  const categories = useQuery(categoriesQuery());

  const goTo = (next: number) =>
    void navigate({ search: (prev) => cleanSearch({ ...prev, page: next > 1 ? next : undefined }) });
  // Any change to the filters or the order starts again at page 1.
  const update = (next: { name?: string; category?: number; sort?: string }) =>
    navigate({ search: (prev) => cleanSearch({ ...prev, ...next, page: undefined }) });
  const categoryName = categories.data?.find((c) => c.category_id === category)?.name;

  return (
    <>
      <PageHeader title="Products" />
      <FilterBar>
        <SearchField
          id="product-name"
          label="Product name"
          placeholder="For example, chai"
          value={name}
          onSearch={(value) => update({ name: value })}
        />
        <SelectField
          id="product-category"
          label="Category"
          allLabel="All categories"
          value={category ? String(category) : undefined}
          options={(categories.data ?? []).map((c) => ({ value: String(c.category_id), label: c.name }))}
          failed={optionsFailed(categories, "Categories")}
          onChange={(value) => update({ category: value ? Number(value) : undefined })}
        />
      </FilterBar>

      {products.isPending ? (
        <LoadingRows label="Loading products" />
      ) : products.isError ? (
        <ErrorState error={products.error} what="The product list" onRetry={() => void products.refetch()} />
      ) : products.data.items.length === 0 && products.data.pagination.total > 0 ? (
        <PastTheEnd page={page} onPage={goTo} />
      ) : products.data.items.length === 0 ? (
        <EmptyState
          title={`No products${name ? ` matching “${name}”` : ""}${categoryName ? ` in ${categoryName}` : ""}.`}
          description="Check the spelling, or search all categories."
          action={<Button onClick={() => void navigate({ search: {} })}>Clear search</Button>}
        />
      ) : (
        <>
          <DataTable
            columns={productColumns}
            data={products.data.items}
            stale={products.isPlaceholderData}
            sorting={{ sort, onSort: (next) => void update({ sort: next }) }}
          />
          <Pager pagination={products.data.pagination} onPage={goTo} />
        </>
      )}
    </>
  );
}
