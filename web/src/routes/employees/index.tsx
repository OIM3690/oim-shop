import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableFeatures } from "@/components/data-table/features";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingRows } from "@/components/query-states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Employee } from "@/lib/api";
import { fullName, reportingTree, type ReportingNode } from "@/lib/employees";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { employeesQuery } from "@/lib/queries";

export const Route = createFileRoute("/employees/")({
  component: EmployeesPage,
});

const column = createColumnHelper<DataTableFeatures, Employee>();

function EmployeeLink({ employee }: { employee: Employee }) {
  return (
    <Link
      to="/employees/$employeeId"
      params={{ employeeId: String(employee.employee_id) }}
      className="hover:underline"
    >
      {fullName(employee)}
    </Link>
  );
}

function columnsFor(employees: Employee[]) {
  const byId = new Map(employees.map((e) => [e.employee_id, e]));
  return column.columns([
    column.display({
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <span className="text-primary font-medium">
            <EmployeeLink employee={row.original} />
          </span>
          {row.original.is_rep ? <Badge variant="secondary">New rep</Badge> : null}
        </span>
      ),
    }),
    column.accessor("title", { header: "Title" }),
    column.accessor("reports_to", {
      header: "Reports to",
      cell: ({ getValue }) => {
        const manager = byId.get(getValue() ?? -1);
        return manager ? (
          <EmployeeLink employee={manager} />
        ) : (
          <span className="text-muted-foreground">No one</span>
        );
      },
    }),
    column.display({
      id: "location",
      header: "Location",
      cell: ({ row }) =>
        [row.original.city, row.original.country].filter(Boolean).join(", ") || (
          <span className="text-muted-foreground">Not recorded</span>
        ),
    }),
    column.accessor("hire_date", {
      header: "Hired",
      cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(getValue())}</span>,
    }),
    column.accessor("order_count", {
      header: () => <div className="text-right">Orders</div>,
      cell: ({ getValue }) => <div className="text-right tabular-nums">{formatCount(getValue())}</div>,
    }),
    column.accessor("revenue_dollars", {
      header: () => <div className="text-right">Revenue</div>,
      cell: ({ getValue }) => <div className="text-right tabular-nums">{formatMoney(getValue())}</div>,
    }),
  ]);
}

function ReportingList({ nodes, label }: { nodes: ReportingNode[]; label?: string }) {
  return (
    <ul aria-label={label} className={label ? "space-y-2" : "mt-2 space-y-2 border-l pl-4"}>
      {nodes.map(({ employee, reports }) => (
        <li key={employee.employee_id}>
          <p>
            <EmployeeLink employee={employee} />
            <span className="text-muted-foreground text-sm">, {employee.title}</span>
          </p>
          {reports.length > 0 ? <ReportingList nodes={reports} /> : null}
        </li>
      ))}
    </ul>
  );
}

function EmployeesPage() {
  const employees = useQuery(employeesQuery());

  return (
    <>
      <PageHeader title="Employees" />
      {employees.isPending ? (
        <LoadingRows label="Loading employees" rows={9} />
      ) : employees.isError ? (
        <ErrorState
          error={employees.error}
          what="The employee list"
          onRetry={() => void employees.refetch()}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <DataTable columns={columnsFor(employees.data)} data={employees.data} />
          <Card>
            <CardHeader>
              <CardTitle>Reporting lines</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportingList nodes={reportingTree(employees.data)} label="Reporting lines" />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
