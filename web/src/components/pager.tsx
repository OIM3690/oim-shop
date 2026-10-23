import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Pagination } from "@/lib/api";
import { formatCount } from "@/lib/format";

interface PagerProps {
  pagination: Pagination;
  onPage: (page: number) => void;
}

/** Previous and next through the API's pages, with where you are. */
export function Pager({ pagination, onPage }: PagerProps) {
  const { page, pages, per_page, total, has_prev, has_next } = pagination;
  const first = (page - 1) * per_page + 1;
  const last = Math.min(page * per_page, total);

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
      <p className="text-muted-foreground whitespace-nowrap tabular-nums">
        {formatCount(first)}–{formatCount(last)} of {formatCount(total)}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground whitespace-nowrap tabular-nums">
            Page {formatCount(page)} of {formatCount(pages)}
          </span>
          <Button variant="outline" size="sm" disabled={!has_prev} onClick={() => onPage(page - 1)}>
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!has_next} onClick={() => onPage(page + 1)}>
            Next
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
