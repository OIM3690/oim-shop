import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import { sortable, type DataTableFeatures } from "@/components/data-table/features";
import { FilterBar, SearchField, SelectField } from "@/components/filters";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { EmptyState, ErrorState, LoadingRows, PastTheEnd } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import type { Customer } from "@/lib/api";
import { formatCount, formatMoney } from "@/lib/format";
import { customersQuery } from "@/lib/queries";
import { useCountries } from "@/lib/use-countries";
import { cleanSearch } from "@/lib/search";
import { sortParam } from "@/lib/sorting";

const searchSchema = z.object({
  name: z.string().optional().catch(undefined),
  country: z.string().optional().catch(undefined),
  sort: sortParam(["company_name", "country", "order_count", "revenue"] as const),
  page: z.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/customers/")({
  validateSearch: searchSchema,
  component: CustomersPage,
});

const notRecorded = <span className="text-muted-foreground">Not recorded</span>;
const column = createColumnHelper<DataTableFeatures, Customer>();

const columns = column.columns([
  column.accessor("company_name", {
    header: "Company",
    meta: sortable("company_name"),
    cell: ({ row }) => (
      <Link
        to="/customers/$customerId"
        params={{ customerId: row.original.customer_id }}
        className="text-primary font-medium hover:underline"
      >
        {row.original.company_name}
      </Link>
    ),
  }),
  column.accessor("contact_name", { header: "Contact" }),
  column.accessor("city", { header: "City", cell: ({ getValue }) => getValue() ?? notRecorded }),
  column.accessor("country", {
    header: "Country",
    meta: sortable("country"),
    cell: ({ getValue }) => getValue() ?? notRecorded,
  }),
  column.accessor("order_count", {
    header: "Orders",
    meta: sortable("order_count", true),
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatCount(getValue())}</div>,
  }),
  column.accessor("revenue_dollars", {
    header: "Revenue",
    meta: sortable("revenue", true),
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatMoney(getValue())}</div>,
  }),
]);

function CustomersPage() {
  const { name, country, sort, page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const customers = useQuery(customersQuery({ name, country, sort, page }));
  const countries = useCountries();

  const goTo = (next: number) =>
    void navigate({ search: (prev) => cleanSearch({ ...prev, page: next > 1 ? next : undefined }) });
  // Any change to the filters or the order starts again at page 1.
  const filter = (next: { name?: string; country?: string; sort?: string }) =>
    navigate({ search: (prev) => cleanSearch({ ...prev, ...next, page: undefined }) });

  return (
    <>
      <PageHeader title="Customers" />
      <FilterBar>
        <SearchField
          id="customer-name"
          label="Company name"
          placeholder="For example, markt"
          value={name}
          onSearch={(value) => filter({ name: value })}
        />
        <SelectField
          id="customer-country"
          label="Country"
          allLabel="All countries"
          value={country}
          options={countries.options}
          failed={countries.failed}
          onChange={(value) => filter({ country: value })}
        />
      </FilterBar>

      {customers.isPending ? (
        <LoadingRows label="Loading customers" />
      ) : customers.isError ? (
        <ErrorState
          error={customers.error}
          what="The customer list"
          onRetry={() => void customers.refetch()}
        />
      ) : customers.data.items.length === 0 && customers.data.pagination.total > 0 ? (
        <PastTheEnd page={page} onPage={goTo} />
      ) : customers.data.items.length === 0 ? (
        <EmptyState
          title={`No customers${name ? ` matching “${name}”` : ""}${country ? ` in ${country}` : ""}.`}
          description="Check the spelling, or search all countries."
          action={<Button onClick={() => void navigate({ search: {} })}>Clear search</Button>}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={customers.data.items}
            stale={customers.isPlaceholderData}
            sorting={{ sort, onSort: (next) => void filter({ sort: next }) }}
          />
          <Pager pagination={customers.data.pagination} onPage={goTo} />
        </>
      )}
    </>
  );
}
