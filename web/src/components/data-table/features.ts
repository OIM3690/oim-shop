import { tableFeatures } from "@tanstack/react-table";

// The API already pages, filters and orders every list, so these tables use
// none of TanStack Table's own row features; they only lay out the columns.
export const features = tableFeatures({});

export type DataTableFeatures = typeof features;
