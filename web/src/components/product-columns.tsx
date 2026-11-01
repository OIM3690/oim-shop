import { createColumnHelper } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import type { DataTableFeatures } from "@/components/data-table/features";
import { StockLabel } from "@/components/status-badges";
import type { Product } from "@/lib/api";
import { formatMoney } from "@/lib/format";

// The product table, on the product list and on a supplier's page.
const column = createColumnHelper<DataTableFeatures, Product>();

export const productColumns = column.columns([
  column.accessor("name", {
    header: "Product",
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
  column.accessor("quantity_per_unit", { header: "Quantity per unit" }),
  column.accessor("unit_price_dollars", {
    header: () => <div className="text-right">Unit price</div>,
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatMoney(getValue())}</div>,
  }),
  column.display({
    id: "stock",
    header: () => <div className="text-right">In stock</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <StockLabel product={row.original} />
      </div>
    ),
  }),
]);
