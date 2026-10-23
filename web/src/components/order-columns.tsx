import { createColumnHelper } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import type { DataTableFeatures } from "@/components/data-table/features";
import { SortHeader } from "@/components/sort-header";
import { ShippedBadge } from "@/components/status-badges";
import type { OrderSummary } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";

const column = createColumnHelper<DataTableFeatures, OrderSummary>();

const orderColumn = column.accessor("order_id", {
  header: "Order",
  cell: ({ getValue }) => (
    <Link
      to="/orders/$orderId"
      params={{ orderId: String(getValue()) }}
      className="text-primary font-medium hover:underline"
    >
      {getValue()}
    </Link>
  ),
});

const dateColumn = column.accessor("order_date", {
  header: "Date",
  cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(getValue())}</span>,
});

const customerColumn = column.accessor("customer_name", {
  header: "Customer",
  cell: ({ row }) => (
    <Link
      to="/customers/$customerId"
      params={{ customerId: row.original.customer_id }}
      className="hover:underline"
    >
      {row.original.customer_name}
    </Link>
  ),
});

const employeeColumn = column.accessor("employee_name", {
  header: "Employee",
  cell: ({ row }) => (
    <Link
      to="/employees/$employeeId"
      params={{ employeeId: String(row.original.employee_id) }}
      className="hover:underline"
    >
      {row.original.employee_name}
    </Link>
  ),
});

const shipToColumn = column.display({
  id: "ship-to",
  header: "Ship to",
  cell: ({ row }) =>
    [row.original.ship_city, row.original.ship_country].filter(Boolean).join(", ") || "Not recorded",
});

const totalColumn = column.accessor("order_total_dollars", {
  header: () => <div className="text-right">Total</div>,
  cell: ({ getValue }) => <div className="text-right tabular-nums">{formatMoney(getValue())}</div>,
});

const statusColumn = column.accessor("shipped_date", {
  header: "Status",
  cell: ({ getValue }) => <ShippedBadge shippedDate={getValue()} />,
});

export interface OrderSorting {
  sort: string | undefined;
  onSort: (sort: string | undefined) => void;
}

/**
 * Columns for a list of orders; a page about one customer or employee leaves
 * that column out. With sorting, Date and Total sort on the server.
 */
export function orderColumns(leaveOut?: "customer" | "employee", sorting?: OrderSorting) {
  const date = sorting
    ? {
        ...dateColumn,
        header: () => <SortHeader label="Date" field="order_date" {...sorting} firstDirection="desc" />,
      }
    : dateColumn;
  const total = sorting
    ? {
        ...totalColumn,
        header: () => (
          <SortHeader label="Total" field="order_total" {...sorting} align="right" firstDirection="desc" />
        ),
      }
    : totalColumn;
  return column.columns([
    orderColumn,
    date,
    ...(leaveOut === "customer" ? [] : [customerColumn]),
    ...(leaveOut === "employee" ? [] : [employeeColumn]),
    shipToColumn,
    total,
    statusColumn,
  ]);
}
