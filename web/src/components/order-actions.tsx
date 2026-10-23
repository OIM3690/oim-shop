import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { PackageCheck, Pencil, Trash2 } from "lucide-react";
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
  });

  if (!canChange) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <Link to="/orders/$orderId/edit" params={{ orderId: String(order.order_id) }}>
          <Pencil aria-hidden="true" />
          Edit
        </Link>
      </Button>
      <Button variant="outline" onClick={() => ship.mutate()} disabled={ship.isPending}>
        <PackageCheck aria-hidden="true" />
        Mark shipped
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
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
            <AlertDialogCancel>Keep the order</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancel.mutate()}>Cancel order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
