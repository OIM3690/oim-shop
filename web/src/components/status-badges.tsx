import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/api";
import { formatCount } from "@/lib/format";

export function StockLabel({ product }: { product: Product }) {
  if (product.discontinued) return <Badge variant="destructive">Discontinued</Badge>;
  if (product.units_in_stock === 0) return <Badge variant="destructive">Out of stock</Badge>;
  return (
    <span className="inline-flex items-center gap-2">
      {product.low_stock ? <Badge variant="outline">Low stock</Badge> : null}
      <span className="tabular-nums">{formatCount(product.units_in_stock)}</span>
    </span>
  );
}

export function ShippedBadge({ shippedDate }: { shippedDate: string | null }) {
  return shippedDate ? (
    <Badge variant="secondary">Shipped</Badge>
  ) : (
    <Badge variant="outline">Not shipped</Badge>
  );
}
