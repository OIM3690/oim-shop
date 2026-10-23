import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/api";
import { formatCount } from "@/lib/format";

function stockState(product: Product) {
  if (product.discontinued) return { label: "Discontinued", variant: "destructive" } as const;
  if (product.units_in_stock === 0) return { label: "Out of stock", variant: "destructive" } as const;
  if (product.low_stock) return { label: "Low stock", variant: "outline" } as const;
  return null;
}

/** A product's state as a badge; `otherwise` when it can be ordered as usual. */
export function StockBadge({ product, otherwise = null }: { product: Product; otherwise?: ReactNode }) {
  const state = stockState(product);
  return state ? <Badge variant={state.variant}>{state.label}</Badge> : otherwise;
}

/** The stock column of the product list: the state, and the count while it can be ordered. */
export function StockLabel({ product }: { product: Product }) {
  if (product.discontinued || product.units_in_stock === 0) return <StockBadge product={product} />;
  return (
    <span className="inline-flex items-center gap-2">
      <StockBadge product={product} />
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
