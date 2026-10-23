import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableFeatures } from "@/components/data-table/features";
import { BackLink, DetailCard, DetailLoading } from "@/components/detail";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/query-states";
import { OrderActions } from "@/components/order-actions";
import { ShippedBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/api";
import { formatCount, formatDate, formatMoney, formatPercent } from "@/lib/format";
import { orderQuery } from "@/lib/queries";

export const Route = createFileRoute("/orders/$orderId")({
  component: OrderPage,
});

const column = createColumnHelper<DataTableFeatures, Order["lines"][number]>();
const right = (text: string) => <div className="text-right">{text}</div>;

const lineColumns = column.columns([
  column.accessor("product_name", {
    header: "Product",
    meta: { wrap: true },
    cell: ({ row }) => (
      <Link
        to="/products/$productId"
        params={{ productId: String(row.original.product_id) }}
        className="text-primary font-medium hover:underline"
      >
        {row.original.product_name}
      </Link>
    ),
  }),
  column.accessor("unit_price_dollars", {
    header: () => right("Unit price"),
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatMoney(getValue())}</div>,
  }),
  column.accessor("quantity", {
    header: () => right("Quantity"),
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatCount(getValue())}</div>,
  }),
  column.accessor("discount_fraction", {
    header: () => right("Discount"),
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatPercent(getValue())}</div>,
  }),
  column.accessor("line_total_dollars", {
    header: () => right("Line total"),
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatMoney(getValue())}</div>,
  }),
]);

function OrderPage() {
  const { orderId } = Route.useParams();
  const order = useQuery(orderQuery(Number(orderId)));

  if (order.isPending) return <DetailLoading label="Loading order" />;
  if (order.isError) {
    return (
      <ErrorState
        titleLevel={1}
        error={order.error}
        what="This order"
        onRetry={() => void order.refetch()}
        notFound={{
          title: `There is no order ${orderId}.`,
          description: "Check the order number, or find the order in the list.",
          action: (
            <Button asChild>
              <Link to="/orders">Back to orders</Link>
            </Button>
          ),
        }}
      />
    );
  }

  const o = order.data;

  return (
    <>
      <BackLink to="/orders">Orders</BackLink>
      <PageHeader
        title={`Order ${o.order_id}`}
        description={`Placed ${formatDate(o.order_date)}`}
        actions={
          <div className="flex items-center gap-2">
            {o.entered ? <Badge variant="outline">Entered here</Badge> : null}
            <ShippedBadge shippedDate={o.shipped_date} />
          </div>
        }
      />
      <OrderActions order={o} />
      <DetailCard
        items={[
          {
            label: "Customer",
            value: (
              <Link
                to="/customers/$customerId"
                params={{ customerId: o.customer_id }}
                className="hover:underline"
              >
                {o.customer_name}
              </Link>
            ),
          },
          {
            label: "Employee",
            value: (
              <Link
                to="/employees/$employeeId"
                params={{ employeeId: String(o.employee_id) }}
                className="hover:underline"
              >
                {o.employee_name}
              </Link>
            ),
          },
          { label: "Required by", value: formatDate(o.required_date) },
          { label: "Shipped", value: o.shipped_date ? formatDate(o.shipped_date) : "Not shipped" },
          { label: "Shipper", value: o.shipper },
          {
            label: "Ship to",
            value: [o.ship_city, o.ship_country].filter(Boolean).join(", ") || "Not recorded",
          },
        ]}
      />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Lines</h2>
        <DataTable columns={lineColumns} data={o.lines} />
        <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Lines total</dt>
          <dd className="text-right font-medium tabular-nums">{formatMoney(o.order_total_dollars)}</dd>
          <dt className="text-muted-foreground">Freight</dt>
          <dd className="text-right tabular-nums">{formatMoney(o.freight_dollars)}</dd>
        </dl>
      </section>
    </>
  );
}
