import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/api";
import { formatCount } from "@/lib/format";

export function StockLabel({ product }: { product: Product }) {
  if (product.discontinued) return <Badge variant="destructive">Discontinued</Badge>;
  if (product.units_in_stock === 0) return <Badge variant="destructive">Out of stock</Badge>;
  return <span className="tabular-nums">{formatCount(product.units_in_stock)}</span>;
}

export function ShippedBadge({ shippedDate }: { shippedDate: string | null }) {
  return shippedDate ? (
    <Badge variant="secondary">Shipped</Badge>
  ) : (
    <Badge variant="outline">Not shipped</Badge>
  );
}
