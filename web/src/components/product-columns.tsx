import { createColumnHelper } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { sortable, type DataTableFeatures } from "@/components/data-table/features";
import { StockLabel } from "@/components/status-badges";
import type { Product } from "@/lib/api";
import { formatMoney } from "@/lib/format";

// The product table, on the product list and on a supplier's page.
const column = createColumnHelper<DataTableFeatures, Product>();

export const productColumns = column.columns([
  column.accessor("name", {
    header: "Product",
    meta: { ...sortable("name"), wrap: true },
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
