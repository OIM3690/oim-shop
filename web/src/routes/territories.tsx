import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingRows } from "@/components/query-states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { regionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/territories")({
  component: TerritoriesPage,
});

function TerritoriesPage() {
  const regions = useQuery(regionsQuery());

  return (
    <>
      <PageHeader
        title="Territories"
        description="Northwind's sales regions, their territories, and the employees who cover each one."
      />
      {regions.isPending ? (
        <LoadingRows label="Loading territories" />
      ) : regions.isError ? (
        <ErrorState error={regions.error} what="The territories" onRetry={() => void regions.refetch()} />
      ) : (
        regions.data.map((region) => (
          <section key={region.region_id} className="space-y-3">
            <h2 className="text-lg font-semibold">{region.name}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Territory</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Covered by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {region.territories.map((t) => (
                  <TableRow key={t.territory_id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="tabular-nums">{t.territory_id}</TableCell>
                    <TableCell className="whitespace-normal">
                      {t.employees.length === 0 ? (
                        <span className="text-muted-foreground">No one</span>
                      ) : (
                        t.employees.map((e, i) => (
                          <span key={e.employee_id}>
                            {i > 0 ? ", " : null}
                            <Link
                              to="/employees/$employeeId"
                              params={{ employeeId: String(e.employee_id) }}
                              className="text-primary hover:underline"
                            >
                              {e.name}
                            </Link>
                          </span>
                        ))
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        ))
      )}
    </>
  );
}
