import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableFeatures } from "@/components/data-table/features";
import { FilterBar, SearchField } from "@/components/filters";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import type { Supplier } from "@/lib/api";
import { suppliersQuery } from "@/lib/queries";
import { cleanSearch } from "@/lib/search";

const searchSchema = z.object({
  name: z.string().optional().catch(undefined),
  page: z.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/suppliers/")({
  validateSearch: searchSchema,
  component: SuppliersPage,
});

const column = createColumnHelper<DataTableFeatures, Supplier>();

const columns = column.columns([
  column.accessor("company_name", {
    header: "Company",
    cell: ({ row }) => (
      <Link
        to="/suppliers/$supplierId"
        params={{ supplierId: String(row.original.supplier_id) }}
        className="text-primary font-medium hover:underline"
      >
        {row.original.company_name}
      </Link>
    ),
  }),
  column.accessor("contact_name", { header: "Contact" }),
  column.accessor("city", { header: "City" }),
  column.accessor("country", { header: "Country" }),
]);

function SuppliersPage() {
  const { name, page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const suppliers = useQuery(suppliersQuery({ name, page }));

  return (
    <>
      <PageHeader title="Suppliers" />
      <FilterBar>
        <SearchField
          id="supplier-name"
          label="Company name"
          placeholder="For example, foods"
          value={name}
          onSearch={(value) => navigate({ search: cleanSearch({ name: value }) })}
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
      ) : suppliers.data.items.length === 0 ? (
        <EmptyState
          title={`No suppliers${name ? ` matching “${name}”` : ""}.`}
          description="Check the spelling, or clear the search."
          action={<Button onClick={() => void navigate({ search: {} })}>Clear search</Button>}
        />
      ) : (
        <>
          <DataTable columns={columns} data={suppliers.data.items} stale={suppliers.isPlaceholderData} />
          <Pager
            pagination={suppliers.data.pagination}
            onPage={(next) =>
              void navigate({ search: (prev) => cleanSearch({ ...prev, page: next > 1 ? next : undefined }) })
            }
          />
        </>
      )}
    </>
  );
}
