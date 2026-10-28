import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Address, NameAndTitle } from "@/components/address";
import { BackLink, DetailCard, DetailLoading } from "@/components/detail";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { supplierQuery } from "@/lib/queries";

export const Route = createFileRoute("/suppliers/$supplierId")({
  component: SupplierPage,
});

const notRecorded = <span className="text-muted-foreground">Not recorded</span>;

function SupplierPage() {
  const { supplierId } = Route.useParams();
  const supplier = useQuery(supplierQuery(Number(supplierId)));

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
    </>
  );
}
