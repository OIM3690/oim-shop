import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BackLink, DetailCard, DetailLoading } from "@/components/detail";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/query-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
              <>
                {p.category}
                {description ? (
                  <span className="text-muted-foreground block text-sm">{description}</span>
                ) : null}
              </>
            ),
          },
          { label: "Supplier", value: p.supplier },
          { label: "Quantity per unit", value: p.quantity_per_unit },
          { label: "Unit price", value: formatMoney(p.unit_price_dollars) },
          { label: "Units in stock", value: formatCount(p.units_in_stock) },
          {
            label: "Status",
            value: p.discontinued ? <Badge variant="destructive">Discontinued</Badge> : "Available to order",
          },
        ]}
      />
    </>
  );
}
