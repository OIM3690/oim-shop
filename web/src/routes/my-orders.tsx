import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import { ORDER_DEFAULT_SORT, orderColumns } from "@/components/order-columns";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { EmptyState, ErrorState, LoadingRows, PastTheEnd } from "@/components/query-states";
import { RepGate } from "@/components/rep-gate";
import { Button } from "@/components/ui/button";
import { myOrdersQuery } from "@/lib/queries";
import { cleanSearch } from "@/lib/search";
import { sortParam } from "@/lib/sorting";

export const Route = createFileRoute("/my-orders")({
  validateSearch: z.object({
    sort: sortParam(["order_date", "order_total"] as const),
    page: z.number().int().positive().optional().catch(undefined),
  }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  return (
    <>
      <PageHeader
        title="My orders"
        description="Open an order to edit it, mark it shipped or cancel it. Entered orders are reset every night."
        actions={
          <Button asChild>
            <Link to="/orders/new">
              <Plus aria-hidden="true" />
              New order
            </Link>
          </Button>
        }
      />
      <RepGate>{() => <MyOrderList />}</RepGate>
    </>
  );
}

function MyOrderList() {
  const { sort, page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const orders = useQuery(myOrdersQuery({ sort, page }));

  if (orders.isPending) return <LoadingRows label="Loading your orders" />;
  if (orders.isError) {
    return <ErrorState error={orders.error} what="Your order list" onRetry={() => void orders.refetch()} />;
  }
  const goTo = (next: number) =>
    void navigate({ search: cleanSearch({ sort, page: next > 1 ? next : undefined }) });
  if (orders.data.items.length === 0) {
    return orders.data.pagination.total > 0 ? (
      <PastTheEnd page={page} onPage={goTo} />
    ) : (
      <EmptyState title="You have not entered an order yet." description="Start with New order." />
    );
  }
  return (
    <>
      <DataTable
        columns={orderColumns("employee")}
        data={orders.data.items}
        stale={orders.isPlaceholderData}
        sorting={{
          sort,
          onSort: (next) => void navigate({ search: cleanSearch({ sort: next }) }),
          defaultSort: ORDER_DEFAULT_SORT,
        }}
      />
      <Pager pagination={orders.data.pagination} onPage={goTo} />
    </>
  );
}
