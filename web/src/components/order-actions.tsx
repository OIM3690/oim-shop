import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { PackageCheck, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api, type OrderSummary } from "@/lib/api";
import { refetchAfterWrite } from "@/lib/queries";
import { useCanChange } from "@/lib/use-can-change";

/** Edit, mark shipped and cancel, for the rep's own unshipped order. */
export function OrderActions({ order }: { order: OrderSummary }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canChange = useCanChange(order);
  const onError = (error: Error) => toast.error(error.message);
  const [confirming, setConfirming] = useState(false);

  const ship = useMutation({
    mutationFn: () => api.shipOrder(order.order_id),
    onSuccess: async () => {
      await refetchAfterWrite(queryClient);
      toast.success(`Order ${order.order_id} marked shipped`);
    },
    onError,
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelOrder(order.order_id),
    onSuccess: async () => {
      await refetchAfterWrite(queryClient);
      toast.success(`Order ${order.order_id} cancelled`);
      await navigate({ to: "/my-orders" });
    },
    onError,
    onSettled: () => setConfirming(false),
  });
  // One change at a time: a second one would race the first on the server.
  const busy = ship.isPending || cancel.isPending;

  if (!canChange) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <Link to="/orders/$orderId/edit" params={{ orderId: String(order.order_id) }}>
          <Pencil aria-hidden="true" />
          Edit
        </Link>
      </Button>
      <Button variant="outline" onClick={() => ship.mutate()} disabled={busy}>
        <PackageCheck aria-hidden="true" />
        Mark shipped
      </Button>
      <AlertDialog open={confirming} onOpenChange={(open) => !cancel.isPending && setConfirming(open)}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={busy}>
            <Trash2 aria-hidden="true" />
            Cancel order
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order {order.order_id}?</AlertDialogTitle>
            <AlertDialogDescription>
              The order is deleted and its products go back into stock. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>Keep the order</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancel.isPending}
              onClick={(event) => {
                // Stay open until the server answers, so the result is seen here.
                event.preventDefault();
                cancel.mutate();
              }}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
