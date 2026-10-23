import { useQuery } from "@tanstack/react-query";
import type { OrderSummary } from "./api";
import { meQuery } from "./queries";

/** True when the signed-in rep entered this order and it has not shipped. */
export function useCanChange(order: OrderSummary) {
  const me = useQuery(meQuery());
  return order.entered && order.shipped_date === null && me.data?.employee?.employee_id === order.employee_id;
}
