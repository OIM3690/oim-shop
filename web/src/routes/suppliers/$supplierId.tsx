import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Address, NameAndTitle } from "@/components/address";
import { DataTable } from "@/components/data-table/data-table";
import { BackLink, DetailCard, DetailLoading } from "@/components/detail";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { productColumns } from "@/components/product-columns";
import { EmptyState, ErrorState, LoadingRows, PastTheEnd } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { productsQuery, supplierQuery } from "@/lib/queries";
import { cleanSearch } from "@/lib/search";
import { sortParam } from "@/lib/sorting";

export const Route = createFileRoute("/suppliers/$supplierId")({
  validateSearch: z.object({
    sort: sortParam(["name", "unit_price", "units_in_stock", "revenue"] as const),
    page: z.number().int().positive().optional().catch(undefined),
  }),
  component: SupplierPage,
});

const notRecorded = <span className="text-muted-foreground">Not recorded</span>;

function SupplierPage() {
  const { supplierId } = Route.useParams();
  const { sort, page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const id = Number(supplierId);
  const supplier = useQuery(supplierQuery(id));
  // The supplier's products come from the server's product list, filtered there.
  const products = useQuery({ ...productsQuery({ supplier: id, sort, page }), enabled: supplier.isSuccess });

  if (supplier.isPending) return <DetailLoading label="Loading supplier" />;
  if (supplier.isError) {
    return (
      <ErrorState
        titleLevel={1}
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
  const goTo = (next: number) =>
    void navigate({ search: cleanSearch({ sort, page: next > 1 ? next : undefined }) });

  return (
    <>
      <BackLink to="/suppliers">Suppliers</BackLink>
      <PageHeader title={s.name} description={[s.city, s.country].filter(Boolean).join(", ") || undefined} />
      <DetailCard
        items={[
          { label: "Contact", value: <NameAndTitle name={s.contact_name} title={s.contact_title} /> },
          {
            label: "Address",
            value: (
              <Address
                address={s.address}
                city={s.city}
                region={s.region}
                postal_code={s.postal_code}
                country={s.country}
              />
            ),
          },
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
        ) : products.data.items.length === 0 && products.data.pagination.total > 0 ? (
          <PastTheEnd page={page} onPage={goTo} />
        ) : products.data.items.length === 0 ? (
          <EmptyState title="No products." description="Northwind buys nothing from this supplier." />
        ) : (
          <>
            <DataTable
              columns={productColumns}
              data={products.data.items}
              stale={products.isPlaceholderData}
              sorting={{ sort, onSort: (next) => void navigate({ search: cleanSearch({ sort: next }) }) }}
            />
            <Pager pagination={products.data.pagination} onPage={goTo} />
          </>
        )}
      </section>
    </>
  );
}
