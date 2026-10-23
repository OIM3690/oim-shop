import { tableFeatures, type CellData, type RowData, type TableFeatures } from "@tanstack/react-table";

// The API already pages, filters and orders every list, so these tables use
// none of TanStack Table's own row features; they only lay out the columns.
export const features = tableFeatures({});

export type DataTableFeatures = typeof features;

/** A column the API can sort by: DataTable draws its header as a sort button. */
export interface SortSpec {
  /** The API's sort key, such as "revenue". */
  field: string;
  /** Which way a first click sorts: numbers usually start with the largest. */
  firstDirection?: "asc" | "desc";
  align?: "left" | "right";
}

declare module "@tanstack/table-core" {
  // The type parameters must match TanStack's declaration, though this field uses none of them.
  // oxlint-disable-next-line no-unused-vars
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    sort?: SortSpec;
  }
}

/** Column meta for a sortable column; a number sits on the right and sorts largest first. */
export const sortable = (field: string, numeric = false): { sort: SortSpec } => ({
  sort: { field, align: numeric ? "right" : "left", firstDirection: numeric ? "desc" : "asc" },
});
