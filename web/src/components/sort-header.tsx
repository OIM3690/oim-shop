import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortSpec } from "@/components/data-table/features";
import { Button } from "@/components/ui/button";
import { sortDirection, type TableSorting } from "@/lib/sorting";
import { cn } from "@/lib/utils";

/**
 * A column header you click to sort on the server. The first click sorts one
 * way, the second the other way, the third returns to the default order.
 */
export function SortHeader({
  label,
  field,
  align = "left",
  firstDirection = "asc",
  ...sorting
}: SortSpec & TableSorting & { label: string }) {
  const first = firstDirection === "desc" ? `-${field}` : field;
  const second = firstDirection === "desc" ? field : `-${field}`;
  const current = sorting.sort ?? sorting.defaultSort;
  const next = current === first ? second : current === second ? undefined : first;
  const state = sortDirection(field, sorting);
  const Icon = state === "ascending" ? ArrowUp : state === "descending" ? ArrowDown : ArrowUpDown;

  return (
    <div className={cn("flex", align === "right" && "justify-end")}>
      <Button
        variant="ghost"
        size="sm"
        className="-mx-2 h-8 px-2"
        aria-label={`Sort by ${label.toLowerCase()}`}
        onClick={() => sorting.onSort(next)}
      >
        {label}
        <Icon className={cn("size-3.5", state === "none" && "text-muted-foreground")} aria-hidden="true" />
      </Button>
    </div>
  );
}
