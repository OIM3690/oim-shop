/** "2016-01-02" -> "2016-01-01". Works on the calendar date, so no time zone can shift it. */
export function dayBefore(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 1));
  return date.toISOString().slice(0, 10);
}
