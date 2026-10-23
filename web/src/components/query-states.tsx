// The three states every view that loads data must design: loading, empty
// and error. Each page passes its own words; the shapes stay the same.
import { AlertCircle, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";

export function LoadingRows({ rows = 8, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2 rounded-lg border p-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  /** Makes the title a heading, for a state that stands in for a whole page or section. */
  titleLevel?: 1 | 2;
}

export function EmptyState({ title, description, action, titleLevel }: EmptyStateProps) {
  const Heading = titleLevel ? (`h${titleLevel}` as const) : "span";
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <Heading>{title}</Heading>
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

interface ErrorStateProps {
  error: unknown;
  /** What failed to load, as in "The order list did not load." */
  what: string;
  onRetry: () => void;
  /** Shown instead of a retry when the API answers 404. */
  notFound?: { title: string; description: string; action: ReactNode };
  /** Makes the title a heading, when this state is the whole page. */
  titleLevel?: 1 | 2;
}

export function ErrorState({ error, what, onRetry, notFound, titleLevel }: ErrorStateProps) {
  const Heading = titleLevel ? (`h${titleLevel}` as const) : "span";
  const status = error instanceof ApiError ? error.status : undefined;

  if (status === 404 && notFound) {
    return <EmptyState {...notFound} titleLevel={titleLevel} />;
  }

  const tooMany = status === 429;
  return (
    <Empty className="border" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircle aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <Heading>{tooMany ? "Too many requests for now." : `${what} did not load.`}</Heading>
        </EmptyTitle>
        <EmptyDescription>
          {tooMany
            ? "The API limits how often one network can ask. Wait a minute, then try again."
            : "Check your internet connection, then try again."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onRetry}>Try again</Button>
      </EmptyContent>
    </Empty>
  );
}
