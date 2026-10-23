/** "2026-10" style month names, counted from the current month. */
export function monthsBack(count: number, from: Date = new Date()) {
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

const label = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
const short = new Intl.DateTimeFormat("en-US", { month: "short" });

/** "2026-10" -> "Oct 2026". */
export function formatMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return label.format(new Date(year, m - 1, 1));
}

/** "2026-10" -> "Oct", for axis ticks; January shows its year. */
export function formatMonthTick(month: string) {
  const [year, m] = month.split("-").map(Number);
  return m === 1 ? String(year) : short.format(new Date(year, m - 1, 1));
}

/** True when a range ends before it starts; "2026-10" and "2026-10-01" both compare as text. */
export const isReversed = (from: string | undefined, to: string | undefined) =>
  Boolean(from && to && from > to);

/**
 * Ticks for the revenue chart's month axis. Over two years, left to itself the
 * chart skips labels to make room and can skip every January, so the years
 * vanish; marking only the Januaries keeps one labelled tick per year.
 */
export function monthTicks(months: string[]) {
  return months.length > 24 ? months.filter((m) => m.endsWith("-01")) : undefined;
}
