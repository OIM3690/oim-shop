import { useQuery } from "@tanstack/react-query";
import { allCustomersQuery } from "./queries";

/** The countries customers are in, sorted, for the filter menus. */
export function useCountries() {
  const customers = useQuery(allCustomersQuery());
  const countries = new Set((customers.data ?? []).flatMap((c) => (c.country ? [c.country] : [])));
  return [...countries].sort().map((country) => ({ value: country, label: country }));
}
