import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import { sortable, type DataTableFeatures } from "@/components/data-table/features";
import { FilterBar, SearchField, SelectField } from "@/components/filters";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-states";
import { StockLabel } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/api";
import { formatMoney } from "@/lib/format";
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

const column = createColumnHelper<DataTableFeatures, Product>();

const columns = column.columns([
  column.accessor("name", {
    header: "Product",
    meta: sortable("name"),
    cell: ({ row }) => (
      <Link
        to="/products/$productId"
        params={{ productId: String(row.original.product_id) }}
        className="text-primary font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  }),
  column.accessor("category", { header: "Category" }),
  column.accessor("unit_price_dollars", {
    header: "Unit price",
    meta: sortable("unit_price", true),
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatMoney(getValue())}</div>,
  }),
  column.display({
    id: "stock",
    header: "In stock",
    meta: sortable("units_in_stock", true),
    cell: ({ row }) => (
      <div className="text-right">
        <StockLabel product={row.original} />
      </div>
    ),
  }),
  column.accessor("revenue_dollars", {
    header: "Revenue",
    meta: sortable("revenue", true),
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatMoney(getValue())}</div>,
  }),
]);

function ProductsPage() {
  const { name, category, sort, page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const products = useQuery(productsQuery({ name, category, sort, page }));
  const categories = useQuery(categoriesQuery());

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
      ) : products.data.items.length === 0 ? (
        <EmptyState
          title={`No products${name ? ` matching “${name}”` : ""}${categoryName ? ` in ${categoryName}` : ""}.`}
          description="Check the spelling, or search all categories."
          action={<Button onClick={() => void navigate({ search: {} })}>Clear search</Button>}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={products.data.items}
            stale={products.isPlaceholderData}
            sorting={{ sort, onSort: (next) => void update({ sort: next }) }}
          />
          <Pager
            pagination={products.data.pagination}
            onPage={(next) =>
              void navigate({ search: (prev) => cleanSearch({ ...prev, page: next > 1 ? next : undefined }) })
            }
          />
        </>
      )}
    </>
  );
}
