import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { BackLink, DetailCard, DetailLoading } from "@/components/detail";
import { OrderList } from "@/components/order-list";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadFailed } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { api, type Employee } from "@/lib/api";
import { dayBefore } from "@/lib/dates";
import { fullName } from "@/lib/employees";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { directoryQuery, employeeQuery } from "@/lib/queries";
import { cleanSearch } from "@/lib/search";
import { sortParam } from "@/lib/sorting";

export const Route = createFileRoute("/employees/$employeeId")({
  validateSearch: z.object({
    sort: sortParam(["order_date", "order_total"] as const),
    page: z.number().int().positive().optional().catch(undefined),
  }),
  component: EmployeePage,
});

function PersonLink({ id, name }: { id: number; name: string }) {
  return (
    <Link to="/employees/$employeeId" params={{ employeeId: String(id) }} className="hover:underline">
      {name}
    </Link>
  );
}

/**
 * The source data has orders dated before the hire date of the employee who
 * took them. One request with per_page=1 asks the API how many there are.
 */
function useOrdersBeforeHire(employee: Employee | undefined) {
  return useQuery({
    queryKey: ["orders-before-hire", employee?.employee_id],
    enabled: Boolean(employee),
    queryFn: async ({ signal }) => {
      if (!employee) return 0;
      const { employee_id, hire_date } = employee;
      const page = await api.orders(
        { employee_id, to_date: dayBefore(hire_date), page: 1, per_page: 1 },
        signal,
      );
      return page.pagination.total;
    },
  });
}

function EmployeePage() {
  const { employeeId } = Route.useParams();
  const { sort, page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const employee = useQuery(employeeQuery(Number(employeeId)));
  const directory = useQuery(directoryQuery());
  const beforeHire = useOrdersBeforeHire(employee.data);

  if (employee.isPending) return <DetailLoading label="Loading employee" />;
  if (employee.isError) {
    return (
      <ErrorState
        titleLevel={1}
        error={employee.error}
        what="This employee"
        onRetry={() => void employee.refetch()}
        notFound={{
          title: `There is no employee ${employeeId}.`,
          description: "Check the address, or find the employee in the list.",
          action: (
            <Button asChild>
              <Link to="/employees">Back to employees</Link>
            </Button>
          ),
        }}
      />
    );
  }

  const e = employee.data;
  const reports = (directory.data ?? []).filter((r) => r.reports_to === e.employee_id);

  return (
    <>
      <BackLink to="/employees">Employees</BackLink>
      <PageHeader title={fullName(e)} description={e.title} />
      <DetailCard
        items={[
          {
            label: "Reports to",
            value:
              e.reports_to && e.manager_name ? (
                <PersonLink id={e.reports_to} name={e.manager_name} />
              ) : (
                "No one"
              ),
          },
          {
            label: "Direct reports",
            value: directory.isPending ? (
              <span className="text-muted-foreground">Loading…</span>
            ) : directory.isError ? (
              <LoadFailed what="Direct reports" onRetry={() => void directory.refetch()} />
            ) : reports.length > 0 ? (
              <span className="flex flex-wrap gap-x-3">
                {reports.map((r) => (
                  <PersonLink key={r.employee_id} id={r.employee_id} name={r.name} />
                ))}
              </span>
            ) : (
              "None"
            ),
          },
          { label: "Hired", value: formatDate(e.hire_date) },
          { label: "Location", value: [e.city, e.country].filter(Boolean).join(", ") || "Not recorded" },
          { label: "Orders taken", value: formatCount(e.order_count) },
          { label: "Revenue, all time", value: formatMoney(e.revenue_dollars) },
        ]}
      />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Orders taken</h2>
        {beforeHire.data ? (
          <p className="text-muted-foreground text-sm">
            {formatCount(beforeHire.data)} of these orders are dated before the hire date,{" "}
            {formatDate(e.hire_date)}. The mismatch is in the source data.
          </p>
        ) : null}
        <OrderList
          query={{ employee_id: e.employee_id, sort, page }}
          sorting={{ sort, onSort: (next) => void navigate({ search: cleanSearch({ sort: next }) }) }}
          leaveOut="employee"
          onPage={(next) =>
            void navigate({ search: cleanSearch({ sort, page: next > 1 ? next : undefined }) })
          }
          empty={{ title: "No orders yet.", description: "This employee has not taken an order so far." }}
        />
      </section>
    </>
  );
}
