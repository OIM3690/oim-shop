import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { ORDER_DEFAULT_SORT, orderColumns } from "@/components/order-columns";
import { Pager } from "@/components/pager";
import { EmptyState, ErrorState, LoadingRows, PastTheEnd } from "@/components/query-states";
import type { TableSorting } from "@/lib/sorting";
import type { OrderQuery } from "@/lib/api";
import { ordersQuery } from "@/lib/queries";

interface OrderListProps {
  query: OrderQuery;
  leaveOut?: "customer" | "employee";
  onPage: (page: number) => void;
  sorting?: Omit<TableSorting, "defaultSort">;
  empty: { title: string; description: string; action?: ReactNode };
}

/** One page of orders from the API, with every state a list needs. */
export function OrderList({ query, leaveOut, onPage, sorting, empty }: OrderListProps) {
  const orders = useQuery(ordersQuery(query));

  if (orders.isPending) return <LoadingRows label="Loading orders" />;
  if (orders.isError) {
    return <ErrorState error={orders.error} what="The order list" onRetry={() => void orders.refetch()} />;
  }
  if (orders.data.items.length === 0) {
    return orders.data.pagination.total > 0 ? (
      <PastTheEnd page={orders.data.pagination.page} onPage={onPage} />
    ) : (
      <EmptyState {...empty} />
    );
  }

  return (
    <>
      <DataTable
        columns={orderColumns(leaveOut)}
        data={orders.data.items}
        stale={orders.isPlaceholderData}
        sorting={sorting && { ...sorting, defaultSort: ORDER_DEFAULT_SORT }}
      />
      <Pager pagination={orders.data.pagination} onPage={onPage} />
    </>
  );
}
