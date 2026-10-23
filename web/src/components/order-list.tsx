import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { orderColumns } from "@/components/order-columns";
import { Pager } from "@/components/pager";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-states";
import type { OrderQuery } from "@/lib/api";
import { ordersQuery } from "@/lib/queries";

interface OrderListProps {
  query: OrderQuery;
  leaveOut?: "customer" | "employee";
  onPage: (page: number) => void;
  empty: { title: string; description: string; action?: ReactNode };
}

/** One page of orders from the API, with every state a list needs. */
export function OrderList({ query, leaveOut, onPage, empty }: OrderListProps) {
  const orders = useQuery(ordersQuery(query));

  if (orders.isPending) return <LoadingRows label="Loading orders" />;
  if (orders.isError) {
    return <ErrorState error={orders.error} what="The order list" onRetry={() => void orders.refetch()} />;
  }
  if (orders.data.items.length === 0) return <EmptyState {...empty} />;

  return (
    <>
      <DataTable columns={orderColumns(leaveOut)} data={orders.data.items} stale={orders.isPlaceholderData} />
      <Pager pagination={orders.data.pagination} onPage={onPage} />
    </>
  );
}
