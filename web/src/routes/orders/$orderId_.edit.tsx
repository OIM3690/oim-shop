import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BackLink, DetailLoading } from "@/components/detail";
import { OrderForm } from "@/components/order-form";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/query-states";
import { RepGate } from "@/components/rep-gate";
import { Button } from "@/components/ui/button";
import { orderQuery } from "@/lib/queries";

export const Route = createFileRoute("/orders/$orderId_/edit")({ component: EditOrderPage });

function EditOrderPage() {
  const { orderId } = Route.useParams();
  const order = useQuery(orderQuery(Number(orderId)));

  return (
    <>
      <BackLink to="/my-orders">My orders</BackLink>
      <PageHeader title={`Edit order ${orderId}`} />
      <RepGate>
        {(rep) => {
          if (order.isPending) return <DetailLoading label="Loading order" />;
          if (order.isError) {
            return <ErrorState error={order.error} what="This order" onRetry={() => void order.refetch()} />;
          }
          const o = order.data;
          if (!o.entered || o.employee_id !== rep.employee_id || o.shipped_date) {
            return (
              <EmptyState
                title="You cannot edit this order."
                description="You can change only the orders you entered, and only before they ship."
                action={
                  <Button asChild>
                    <Link to="/orders/$orderId" params={{ orderId }}>
                      Back to the order
                    </Link>
                  </Button>
                }
              />
            );
          }
          return <OrderForm order={o} />;
        }}
      </RepGate>
    </>
  );
}
