import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/detail";
import { OrderForm } from "@/components/order-form";
import { PageHeader } from "@/components/page-header";
import { RepGate } from "@/components/rep-gate";

export const Route = createFileRoute("/orders/new")({ component: NewOrderPage });

function NewOrderPage() {
  return (
    <>
      <BackLink to="/orders">Orders</BackLink>
      <PageHeader
        title="New order"
        description="Prices come from the catalog. Stock is reserved when you place the order."
      />
      <RepGate>{() => <OrderForm />}</RepGate>
    </>
  );
}
