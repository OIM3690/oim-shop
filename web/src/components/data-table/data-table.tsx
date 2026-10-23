import { useTable, type ColumnDef, type RowData } from "@tanstack/react-table";
import { SortHeader } from "@/components/sort-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sortDirection, type TableSorting } from "@/lib/sorting";
import { cn } from "@/lib/utils";
import { features, type DataTableFeatures } from "./features";

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<DataTableFeatures, TData>[];
  data: TData[];
  /** Dims the rows while a newer page is on its way. */
  stale?: boolean;
  /** With it, columns whose meta names a sort key get a sort button in their header. */
  sorting?: TableSorting;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  stale = false,
  sorting,
}: DataTableProps<TData>) {
  const table = useTable({ features, data, columns });

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table aria-busy={stale}>
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const { header: label, meta } = header.column.columnDef;
                const spec = sorting ? meta?.sort : undefined;
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={spec && sorting ? sortDirection(spec.field, sorting) : undefined}
                  >
                    {header.isPlaceholder ? null : spec && sorting ? (
                      // Drawn here, not by the column, so the button keeps its identity, and
                      // its focus, when a new sort re-renders the table.
                      <SortHeader
                        label={typeof label === "string" ? label : spec.field}
                        {...spec}
                        {...sorting}
                      />
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className={cn("transition-opacity", stale && "opacity-60")}>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cell.column.columnDef.meta?.wrap ? "min-w-40 whitespace-normal" : undefined}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
