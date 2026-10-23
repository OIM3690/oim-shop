const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const count = new Intl.NumberFormat("en-US");
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });

export const formatMoney = (dollars: number) => money.format(dollars);
export const formatCount = (n: number) => count.format(n);
export const formatPercent = (fraction: number) => percent.format(fraction);

/**
 * "2026-10-22T14:59:35" or "2016-01-02" -> "Oct 22, 2026". The API's dates
 * carry no time zone, so the calendar date is read from the text itself;
 * new Date("2016-01-02") would mean midnight UTC, the evening before in Boston.
 */
export function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return date.format(new Date(year, month - 1, day));
}
