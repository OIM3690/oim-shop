import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BackLink, DetailCard, DetailLoading } from "@/components/detail";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/query-states";
import { StockBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { categoryPictureUrl } from "@/lib/api";
import { formatCount, formatMoney } from "@/lib/format";
import { categoriesQuery, productQuery } from "@/lib/queries";

export const Route = createFileRoute("/products/$productId")({
  component: ProductPage,
});

function ProductPage() {
  const { productId } = Route.useParams();
  const id = Number(productId);
  const product = useQuery(productQuery(id));
  const categories = useQuery(categoriesQuery());

  if (product.isPending) return <DetailLoading label="Loading product" />;
  if (product.isError) {
    return (
      <ErrorState
        titleLevel={1}
        error={product.error}
        what="This product"
        onRetry={() => void product.refetch()}
        notFound={{
          title: `There is no product ${productId}.`,
          description: "Check the address, or find the product in the list.",
          action: (
            <Button asChild>
              <Link to="/products">Back to products</Link>
            </Button>
          ),
        }}
      />
    );
  }

  const p = product.data;
  const description = categories.data?.find((c) => c.name === p.category)?.description;

  return (
    <>
      <BackLink to="/products">Products</BackLink>
      <PageHeader title={p.name} description={p.category} />
      <DetailCard
        items={[
          {
            label: "Category",
            value: (
              <div className="flex items-start gap-3">
                <img
                  src={categoryPictureUrl(p.category_id)}
                  alt={p.category}
                  width={64}
                  height={64}
                  className="size-16 shrink-0 rounded-md object-cover"
                />
                <div>
                  {p.category}
                  {description ? (
                    <span className="text-muted-foreground block text-sm">{description}</span>
                  ) : null}
                </div>
              </div>
            ),
          },
          {
            label: "Supplier",
            value: (
              <Link
                to="/suppliers/$supplierId"
                params={{ supplierId: String(p.supplier_id) }}
                className="hover:underline"
              >
                {p.supplier}
              </Link>
            ),
          },
          { label: "Quantity per unit", value: p.quantity_per_unit },
          { label: "Unit price", value: formatMoney(p.unit_price_dollars) },
          { label: "Units in stock", value: formatCount(p.units_in_stock) },
          { label: "Units on order", value: formatCount(p.units_on_order) },
          { label: "Reorder level", value: formatCount(p.reorder_level) },
          { label: "Revenue, all time", value: formatMoney(p.revenue_dollars) },
          {
            label: "Status",
            value: <StockBadge product={p} otherwise="Available to order" />,
          },
        ]}
      />
    </>
  );
}
