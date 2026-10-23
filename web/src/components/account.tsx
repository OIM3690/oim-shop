import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Plus } from "lucide-react";
import { GitHubMark } from "@/components/github-mark";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { api, SIGN_IN_URL } from "@/lib/api";
import { meQuery } from "@/lib/queries";

/** The bottom of the sidebar: sign in, or who you are with New order and Sign out. */
export function Account() {
  const me = useQuery(meQuery());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // On a phone the menu covers the page, so following a link closes it.
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);
  const signOut = useMutation({
    mutationFn: api.signOut,
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: "/" });
      toast.success("Signed out");
    },
    onError: () => toast.error("Signing out did not work. Try again."),
  });

  if (me.isPending) return null;
  if (me.isError) {
    return (
      <div className="space-y-2 p-2">
        <p className="text-muted-foreground text-xs">Could not check whether you are signed in.</p>
        <Button variant="outline" className="w-full" onClick={() => void me.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!me.data?.signed_in) {
    return (
      <div className="space-y-2 p-2">
        <p className="text-muted-foreground text-xs">Sign in to enter orders as a new sales rep.</p>
        <Button asChild variant="outline" className="w-full">
          <a href={SIGN_IN_URL}>
            <GitHubMark />
            Sign in with GitHub
          </a>
        </Button>
      </div>
    );
  }

  const employee = me.data.employee;
  return (
    <div className="space-y-2 p-2">
      {employee ? (
        <>
          <p className="text-sm">
            <span className="text-muted-foreground block text-xs">Signed in as</span>
            <Link
              to="/employees/$employeeId"
              params={{ employeeId: String(employee.employee_id) }}
              onClick={close}
              className="font-medium wrap-anywhere hover:underline"
            >
              {employee.name}
            </Link>
          </p>
          <Button asChild className="w-full">
            <Link to="/orders/new" onClick={close}>
              <Plus aria-hidden="true" />
              New order
            </Link>
          </Button>
        </>
      ) : (
        <Button asChild className="w-full">
          <Link to="/welcome" onClick={close}>
            Choose your name
          </Link>
        </Button>
      )}
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
      >
        <LogOut aria-hidden="true" />
        Sign out
      </Button>
    </div>
  );
}
