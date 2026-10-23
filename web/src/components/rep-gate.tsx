import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { GitHubMark } from "@/components/github-mark";
import { EmptyState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SIGN_IN_URL, type Employee } from "@/lib/api";
import { meQuery } from "@/lib/queries";

/** Shows its children only to a signed-in rep who has chosen a display name. */
export function RepGate({ children }: { children: (rep: Employee) => ReactNode }) {
  const me = useQuery(meQuery());
  if (me.isPending) return <Skeleton className="h-64 w-full" />;
  if (!me.data?.signed_in) {
    return (
      <EmptyState
        title="Sign in to enter orders."
        description="Signing in with GitHub makes you a new sales rep at Northwind. The app keeps your GitHub user ID and the name you choose, nothing else."
        action={
          <Button asChild>
            <a href={SIGN_IN_URL}>
              <GitHubMark />
              Sign in with GitHub
            </a>
          </Button>
        }
      />
    );
  }
  if (!me.data.employee) {
    return (
      <EmptyState
        title="Choose your display name first."
        description="Other people see this name next to the orders you enter."
        action={
          <Button asChild>
            <Link to="/welcome">Choose your name</Link>
          </Button>
        }
      />
    );
  }
  return <>{children(me.data.employee)}</>;
}
