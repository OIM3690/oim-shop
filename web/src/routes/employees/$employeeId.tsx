import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Address } from "@/components/address";
import { BackLink, DetailCard, DetailLoading } from "@/components/detail";
import { OrderList } from "@/components/order-list";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadFailed } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { api, employeePhotoUrl, type Employee, type EmployeeDetail } from "@/lib/api";
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
          { label: "Title of courtesy", value: e.title_of_courtesy ?? "Not recorded" },
          { label: "Hired", value: formatDate(e.hire_date) },
          { label: "Location", value: [e.city, e.country].filter(Boolean).join(", ") || "Not recorded" },
          {
            label: "Territories",
            value:
              e.territories.length > 0
                ? e.territories
                    .map((t) => t.name)
                    .sort()
                    .join(", ")
                : "None",
          },
          { label: "Orders taken", value: formatCount(e.order_count) },
          { label: "Revenue, all time", value: formatMoney(e.revenue_dollars) },
        ]}
      />
      {e.personal ? <PersonalDetails employee={e} personal={e.personal} /> : null}
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

/**
 * Birth date, home address, phones, notes and photo. The server sends them
 * only to someone signed in; for a visitor, personal is null and this
 * section is not drawn.
 */
function PersonalDetails({
  employee,
  personal,
}: {
  employee: EmployeeDetail;
  personal: NonNullable<EmployeeDetail["personal"]>;
}) {
  const p = personal;
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Personal details</h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {p.has_photo ? (
          <img
            src={employeePhotoUrl(employee.employee_id)}
            alt={`Photo of ${employee.name}`}
            width={120}
            height={150}
            className="h-auto w-30 shrink-0 rounded-md"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <DetailCard
            items={[
              { label: "Born", value: p.birth_date ? formatDate(p.birth_date) : "Not recorded" },
              {
                label: "Home address",
                value: (
                  <Address
                    address={p.address}
                    city={employee.city}
                    region={p.region}
                    postal_code={p.postal_code}
                    country={employee.country}
                  />
                ),
              },
              { label: "Home phone", value: p.home_phone ?? "Not recorded" },
              { label: "Extension", value: p.extension ?? "Not recorded" },
            ]}
          />
        </div>
      </div>
      {p.notes ? <p className="max-w-prose text-sm leading-relaxed">{p.notes}</p> : null}
    </section>
  );
}
