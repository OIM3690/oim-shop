import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import { orderColumns } from "@/components/order-columns";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-states";
import { RepGate } from "@/components/rep-gate";
import { Button } from "@/components/ui/button";
import { myOrdersQuery } from "@/lib/queries";

export const Route = createFileRoute("/my-orders")({
  validateSearch: z.object({ page: z.number().int().positive().optional().catch(undefined) }),
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
  const { page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const orders = useQuery(myOrdersQuery(page));

  if (orders.isPending) return <LoadingRows label="Loading your orders" />;
  if (orders.isError) {
    return <ErrorState error={orders.error} what="Your order list" onRetry={() => void orders.refetch()} />;
  }
  if (orders.data.items.length === 0) {
    return <EmptyState title="You have not entered an order yet." description="Start with New order." />;
  }
  return (
    <>
      <DataTable
        columns={orderColumns("employee")}
        data={orders.data.items}
        stale={orders.isPlaceholderData}
      />
      <Pager
        pagination={orders.data.pagination}
        onPage={(next) => void navigate({ search: { page: next > 1 ? next : undefined } })}
      />
    </>
  );
}
