import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { displayName } from "api/schemas";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, SIGN_IN_URL } from "@/lib/api";
import { meQuery } from "@/lib/queries";

export const Route = createFileRoute("/welcome")({ component: WelcomePage });

const schema = z.object({ display_name: displayName });

function WelcomePage() {
  const me = useQuery(meQuery());
  if (me.isPending) return <Skeleton className="h-48 w-full" />;
  if (me.isError) {
    return <ErrorState error={me.error} what="Your account" onRetry={() => void me.refetch()} />;
  }
  if (!me.data?.signed_in) {
    return (
      <EmptyState
        title="You are not signed in."
        description="Sign in with GitHub first, then choose your name."
        action={
          <Button asChild>
            <a href={SIGN_IN_URL}>Sign in with GitHub</a>
          </Button>
        }
      />
    );
  }
  return <NameForm current={me.data.employee?.name} manager={me.data.role === "manager"} />;
}

function NameForm({ current, manager }: { current: string | undefined; manager: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: current ?? "" },
  });
  const save = useMutation({
    mutationFn: (values: z.infer<typeof schema>) => api.setDisplayName(values.display_name),
    onSuccess: async (me) => {
      queryClient.setQueryData(meQuery().queryKey, me);
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(current ? "Name saved" : `Welcome, ${me.employee?.name}`);
      if (!current) await navigate({ to: "/orders/new" });
    },
    onError: (error) => {
      form.setError(
        "display_name",
        { message: error instanceof ApiError ? error.message : "Saving failed. Try again." },
        { shouldFocus: true },
      );
    },
  });

  return (
    <>
      <PageHeader
        title={current ? "Your display name" : "Welcome to Northwind"}
        description={
          current
            ? "This name appears next to the orders you enter."
            : manager
              ? "You are joining as a sales manager, reporting to Andrew Fuller, Vice President, Sales. Choose the name people signed in here will see."
              : "You are joining as a sales rep, reporting to the Sales Manager. Choose the name you and the managers will see."
        }
      />
      <Card className="max-w-lg">
        <CardContent>
          <form
            onSubmit={form.handleSubmit((values) => save.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <Controller
              name="display_name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="display-name">Display name</FieldLabel>
                  <Input
                    {...field}
                    id="display-name"
                    autoComplete="nickname"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "display-name-hint display-name-error" : "display-name-hint"
                    }
                  />
                  <FieldDescription id="display-name-hint">
                    Up to 40 letters, digits, spaces, and . ' -. Your GitHub username is never shown.
                  </FieldDescription>
                  <FieldError id="display-name-error" errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Button type="submit" disabled={save.isPending}>
              {current ? "Save name" : manager ? "Start as a sales manager" : "Start as a sales rep"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
