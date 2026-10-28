import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import { sortable, type DataTableFeatures } from "@/components/data-table/features";
import { FilterBar, SearchField } from "@/components/filters";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { EmptyState, ErrorState, LoadingRows, PastTheEnd } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import type { Supplier } from "@/lib/api";
import { formatCount } from "@/lib/format";
import { suppliersQuery } from "@/lib/queries";
import { cleanSearch } from "@/lib/search";
import { sortParam } from "@/lib/sorting";

const searchSchema = z.object({
  name: z.string().optional().catch(undefined),
  sort: sortParam(["name", "country", "product_count"] as const),
  page: z.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/suppliers/")({
  validateSearch: searchSchema,
  component: SuppliersPage,
});

const column = createColumnHelper<DataTableFeatures, Supplier>();

const columns = column.columns([
  column.accessor("name", {
    header: "Company",
    meta: { ...sortable("name"), wrap: true },
    cell: ({ row }) => (
      <Link
        to="/suppliers/$supplierId"
        params={{ supplierId: String(row.original.supplier_id) }}
        className="text-primary font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  }),
  column.accessor("contact_name", { header: "Contact", meta: { wrap: true } }),
  column.accessor("city", { header: "City" }),
  column.accessor("country", { header: "Country", meta: sortable("country") }),
  column.accessor("product_count", {
    header: "Products",
    meta: sortable("product_count", true),
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatCount(getValue())}</div>,
  }),
]);

function SuppliersPage() {
  const { name, sort, page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const suppliers = useQuery(suppliersQuery({ name, sort, page }));

  const goTo = (next: number) =>
    void navigate({ search: (prev) => cleanSearch({ ...prev, page: next > 1 ? next : undefined }) });
  // Any change to the search or the order starts again at page 1.
  const filter = (next: { name?: string; sort?: string }) =>
    navigate({ search: (prev) => cleanSearch({ ...prev, ...next, page: undefined }) });

  return (
    <>
      <PageHeader title="Suppliers" />
      <FilterBar>
        <SearchField
          id="supplier-name"
          label="Company name"
          placeholder="For example, foods"
          value={name}
          onSearch={(value) => filter({ name: value })}
        />
      </FilterBar>

      {suppliers.isPending ? (
        <LoadingRows label="Loading suppliers" />
      ) : suppliers.isError ? (
        <ErrorState
          error={suppliers.error}
          what="The supplier list"
          onRetry={() => void suppliers.refetch()}
        />
      ) : suppliers.data.items.length === 0 && suppliers.data.pagination.total > 0 ? (
        <PastTheEnd page={page} onPage={goTo} />
      ) : suppliers.data.items.length === 0 ? (
        <EmptyState
          title={`No suppliers${name ? ` matching “${name}”` : ""}.`}
          description="Check the spelling, or clear the search."
          action={<Button onClick={() => void navigate({ search: {} })}>Clear search</Button>}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={suppliers.data.items}
            stale={suppliers.isPlaceholderData}
            sorting={{ sort, onSort: (next) => void filter({ sort: next }) }}
          />
          <Pager pagination={suppliers.data.pagination} onPage={goTo} />
        </>
      )}
    </>
  );
}
