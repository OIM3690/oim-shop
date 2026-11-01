import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Address, NameAndTitle } from "@/components/address";
import { DataTable } from "@/components/data-table/data-table";
import { BackLink, DetailCard, DetailLoading } from "@/components/detail";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { productColumns } from "@/components/product-columns";
import { EmptyState, ErrorState, LoadingRows } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { productsQuery, supplierQuery } from "@/lib/queries";
import { cleanSearch } from "@/lib/search";

export const Route = createFileRoute("/suppliers/$supplierId")({
  validateSearch: z.object({ page: z.number().int().positive().optional().catch(undefined) }),
  component: SupplierPage,
});

const notRecorded = <span className="text-muted-foreground">Not recorded</span>;

function SupplierPage() {
  const { supplierId } = Route.useParams();
  const { page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const id = Number(supplierId);
  const supplier = useQuery(supplierQuery(id));
  // oim-api filters the products by supplier; the browser never filters a page itself.
  const products = useQuery({ ...productsQuery({ supplier_id: id, page }), enabled: supplier.isSuccess });

  if (supplier.isPending) return <DetailLoading label="Loading supplier" />;
  if (supplier.isError) {
    return (
      <ErrorState
        error={supplier.error}
        what="This supplier"
        onRetry={() => void supplier.refetch()}
        notFound={{
          title: `There is no supplier ${supplierId}.`,
          description: "Check the address, or find the supplier in the list.",
          action: (
            <Button asChild>
              <Link to="/suppliers">Back to suppliers</Link>
            </Button>
          ),
        }}
      />
    );
  }

  const s = supplier.data;

  return (
    <>
      <BackLink to="/suppliers">Suppliers</BackLink>
      <PageHeader
        title={s.company_name}
        description={[s.city, s.country].filter(Boolean).join(", ") || undefined}
      />
      <DetailCard
        items={[
          { label: "Contact", value: <NameAndTitle name={s.contact_name} title={s.contact_title} /> },
          { label: "Address", value: <Address {...s} /> },
          { label: "Phone", value: s.phone ?? notRecorded },
          { label: "Fax", value: s.fax ?? notRecorded },
          {
            label: "Home page",
            value: s.home_page ? (
              <a href={s.home_page} className="text-primary hover:underline" rel="noreferrer">
                {s.home_page}
              </a>
            ) : (
              notRecorded
            ),
          },
        ]}
      />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Products</h2>
        {products.isPending ? (
          <LoadingRows label="Loading products" />
        ) : products.isError ? (
          <ErrorState
            error={products.error}
            what="This supplier's products"
            onRetry={() => void products.refetch()}
          />
        ) : products.data.items.length === 0 ? (
          <EmptyState title="No products." description="Northwind buys nothing from this supplier." />
        ) : (
          <>
            <DataTable
              columns={productColumns}
              data={products.data.items}
              stale={products.isPlaceholderData}
            />
            <Pager
              pagination={products.data.pagination}
              onPage={(next) => void navigate({ search: cleanSearch({ page: next > 1 ? next : undefined }) })}
            />
          </>
        )}
      </section>
    </>
  );
}
