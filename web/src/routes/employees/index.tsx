import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import { sortable, type DataTableFeatures } from "@/components/data-table/features";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { ErrorState, LoadingRows } from "@/components/query-states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Employee } from "@/lib/api";
import { fullName, reportingTree, type ReportingNode } from "@/lib/employees";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { directoryQuery, employeesQuery } from "@/lib/queries";
import { cleanSearch } from "@/lib/search";
import { sortParam } from "@/lib/sorting";

const searchSchema = z.object({
  sort: sortParam(["name", "hire_date", "order_count", "revenue"] as const),
  page: z.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/employees/")({
  validateSearch: searchSchema,
  component: EmployeesPage,
});

const column = createColumnHelper<DataTableFeatures, Employee>();

function EmployeeLink({ id, name }: { id: number; name: string }) {
  return (
    <Link to="/employees/$employeeId" params={{ employeeId: String(id) }} className="hover:underline">
      {name}
    </Link>
  );
}

const columns = column.columns([
  column.display({
    id: "name",
    header: "Name",
    meta: sortable("name"),
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2">
        <span className="text-primary font-medium">
          <EmployeeLink id={row.original.employee_id} name={fullName(row.original)} />
        </span>
        {row.original.is_rep ? <Badge variant="secondary">New rep</Badge> : null}
      </span>
    ),
  }),
  column.accessor("title", { header: "Title" }),
  column.display({
    id: "reports-to",
    header: "Reports to",
    cell: ({ row }) => {
      const { reports_to, manager_name } = row.original;
      return reports_to && manager_name ? (
        <EmployeeLink id={reports_to} name={manager_name} />
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
    meta: sortable("hire_date"),
    cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(getValue())}</span>,
  }),
  column.accessor("order_count", {
    header: "Orders",
    meta: sortable("order_count", true),
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatCount(getValue())}</div>,
  }),
  column.accessor("revenue_dollars", {
    header: "Revenue",
    meta: sortable("revenue", true),
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatMoney(getValue())}</div>,
  }),
]);

function ReportingList({ nodes, label }: { nodes: ReportingNode[]; label?: string }) {
  return (
    <ul aria-label={label} className={label ? "space-y-2" : "mt-2 space-y-2 border-l pl-4"}>
      {nodes.map(({ employee, reports }) => (
        <li key={employee.employee_id}>
          <p>
            <EmployeeLink id={employee.employee_id} name={employee.name} />
            <span className="text-muted-foreground text-sm">, {employee.title}</span>
          </p>
          {reports.length > 0 ? <ReportingList nodes={reports} /> : null}
        </li>
      ))}
    </ul>
  );
}

function ReportingLines() {
  const directory = useQuery(directoryQuery());
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Reporting lines</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {directory.isPending ? (
          <LoadingRows label="Loading the reporting lines" rows={4} />
        ) : directory.isError ? (
          <ErrorState
            error={directory.error}
            what="The reporting lines"
            onRetry={() => void directory.refetch()}
          />
        ) : (
          <ReportingList nodes={reportingTree(directory.data)} label="Reporting lines" />
        )}
      </CardContent>
    </Card>
  );
}

function EmployeesPage() {
  const { sort, page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const employees = useQuery(employeesQuery({ sort, page }));

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
        <>
          <DataTable
            columns={columns}
            data={employees.data.items}
            stale={employees.isPlaceholderData}
            sorting={{ sort, onSort: (next) => void navigate({ search: cleanSearch({ sort: next }) }) }}
          />
          <Pager
            pagination={employees.data.pagination}
            onPage={(next) =>
              void navigate({ search: cleanSearch({ sort, page: next > 1 ? next : undefined }) })
            }
          />
        </>
      )}
      <ReportingLines />
    </>
  );
}
