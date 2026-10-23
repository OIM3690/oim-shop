import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SortHeaderProps {
  label: string;
  /** The API's sort key for this column, such as "revenue". */
  field: string;
  /** The current sort, such as "revenue" or "-revenue" (descending). */
  sort: string | undefined;
  onSort: (sort: string | undefined) => void;
  align?: "left" | "right";
  /** Which way a first click sorts: numbers usually start with the largest. */
  firstDirection?: "asc" | "desc";
}

/**
 * A column header you click to sort on the server. The first click sorts one
 * way, the second the other way, the third returns to the default order.
 */
export function SortHeader({
  label,
  field,
  sort,
  onSort,
  align = "left",
  firstDirection = "asc",
}: SortHeaderProps) {
  const first = firstDirection === "desc" ? `-${field}` : field;
  const second = firstDirection === "desc" ? field : `-${field}`;
  const state = sort === field ? "asc" : sort === `-${field}` ? "desc" : "none";
  const next = sort === first ? second : sort === second ? undefined : first;
  const Icon = state === "asc" ? ArrowUp : state === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div className={cn("flex", align === "right" && "justify-end")}>
      <Button
        variant="ghost"
        size="sm"
        className="-mx-2 h-8 px-2"
        aria-label={`Sort by ${label.toLowerCase()}`}
        aria-pressed={state !== "none"}
        onClick={() => onSort(next)}
      >
        {label}
        <Icon className={cn("size-3.5", state === "none" && "text-muted-foreground")} aria-hidden="true" />
      </Button>
    </div>
  );
}
