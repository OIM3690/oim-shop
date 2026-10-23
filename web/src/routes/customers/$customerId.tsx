import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { BackLink, DetailCard, DetailLoading } from "@/components/detail";
import { OrderList } from "@/components/order-list";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { formatCount, formatMoney } from "@/lib/format";
import { customerQuery } from "@/lib/queries";
import { cleanSearch } from "@/lib/search";

export const Route = createFileRoute("/customers/$customerId")({
  validateSearch: z.object({ page: z.number().int().positive().optional().catch(undefined) }),
  component: CustomerPage,
});

function CustomerPage() {
  const { customerId } = Route.useParams();
  const { page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const customer = useQuery(customerQuery(customerId));

  if (customer.isPending) return <DetailLoading label="Loading customer" />;
  if (customer.isError) {
    return (
      <ErrorState
        error={customer.error}
        what="This customer"
        onRetry={() => void customer.refetch()}
        notFound={{
          title: `There is no customer ${customerId}.`,
          description: "Check the address, or find the customer in the list.",
          action: (
            <Button asChild>
              <Link to="/customers">Back to customers</Link>
            </Button>
          ),
        }}
      />
    );
  }

  const c = customer.data;
  const place = [c.city, c.country].filter(Boolean).join(", ");

  return (
    <>
      <BackLink to="/customers">Customers</BackLink>
      <PageHeader title={c.company_name} description={place || undefined} />
      <DetailCard
        items={[
          { label: "Customer ID", value: c.customer_id },
          { label: "Contact", value: c.contact_name },
          { label: "City", value: c.city ?? "Not recorded" },
          { label: "Country", value: c.country ?? "Not recorded" },
          { label: "Orders", value: formatCount(c.order_count) },
          { label: "Revenue, all time", value: formatMoney(c.revenue_dollars) },
        ]}
      />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Orders</h2>
        <OrderList
          query={{ customer_id: c.customer_id, page }}
          leaveOut="customer"
          onPage={(next) => void navigate({ search: cleanSearch({ page: next > 1 ? next : undefined }) })}
          empty={{ title: "No orders yet.", description: "This customer has not placed an order so far." }}
        />
      </section>
    </>
  );
}
