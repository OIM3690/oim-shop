import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DateField, FilterBar, SelectField } from "@/components/filters";
import { OrderList } from "@/components/order-list";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { allCustomersQuery, directoryQuery, optionsFailed } from "@/lib/queries";
import { cleanSearch } from "@/lib/search";
import { sortParam } from "@/lib/sorting";
import { useCountries } from "@/lib/use-countries";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const searchSchema = z.object({
  customer: z.string().optional().catch(undefined),
  employee: z.number().int().positive().optional().catch(undefined),
  country: z.string().optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  sort: sortParam(["order_date", "order_total"] as const),
  page: z.number().int().positive().optional().catch(undefined),
});

type OrderSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/orders/")({
  validateSearch: searchSchema,
  component: OrdersPage,
});

function OrdersPage() {
  const { customer, employee, country, from, to, sort, page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const customers = useQuery(allCustomersQuery());
  const employees = useQuery(directoryQuery());
  const countries = useCountries();

  const filter = (next: Partial<OrderSearch>) =>
    navigate({ search: (prev) => cleanSearch({ ...prev, ...next, page: undefined }) });
  const filtered = Boolean(customer || employee || country || from || to);

  return (
    <>
      <PageHeader title="Orders" />
      <FilterBar>
        <SelectField
          id="order-customer"
          label="Customer"
          allLabel="All customers"
          value={customer}
          options={(customers.data ?? [])
            .map((c) => ({ value: c.customer_id, label: c.company_name }))
            .sort((a, b) => a.label.localeCompare(b.label))}
          failed={optionsFailed(customers, "Customers")}
          onChange={(value) => filter({ customer: value })}
        />
        <SelectField
          id="order-employee"
          label="Employee"
          allLabel="All employees"
          value={employee ? String(employee) : undefined}
          options={(employees.data ?? []).map((e) => ({
            value: String(e.employee_id),
            label: e.name,
          }))}
          failed={optionsFailed(employees, "Employees")}
          onChange={(value) => filter({ employee: value ? Number(value) : undefined })}
        />
        <SelectField
          id="order-country"
          label="Ship to country"
          allLabel="All countries"
          value={country}
          options={countries.options}
          failed={countries.failed}
          onChange={(value) => filter({ country: value })}
        />
        <DateField id="order-from" label="From" value={from} onChange={(value) => filter({ from: value })} />
        <DateField id="order-to" label="To" value={to} onChange={(value) => filter({ to: value })} />
        {filtered ? (
          <Button variant="ghost" onClick={() => void navigate({ search: {} })}>
            Clear filters
          </Button>
        ) : null}
      </FilterBar>

      <OrderList
        query={{
          customer_id: customer,
          employee_id: employee,
          country,
          from_date: from,
          to_date: to,
          sort,
          page,
        }}
        sorting={{ sort, onSort: (next) => void filter({ sort: next }) }}
        onPage={(next) =>
          void navigate({ search: (prev) => cleanSearch({ ...prev, page: next > 1 ? next : undefined }) })
        }
        empty={
          filtered
            ? {
                title: "No orders match these filters.",
                description: "Widen the date range, or clear the filters.",
              }
            : { title: "No orders yet.", description: "Orders appear here as customers place them." }
        }
      />
    </>
  );
}
