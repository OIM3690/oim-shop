// oim-api moves every Northwind date forward by the same number of days, so
// orders keep arriving until 2027-06-30. The app uses the same shift, and
// reads the current value from oim-api's /shop when it can.
export const DEFAULT_SHIFT_DAYS = 1341;

const boston = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** The time in Boston as "YYYY-MM-DDTHH:MM:SS", the form the order dates use. */
export function bostonNow(at: Date = new Date()): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    boston.formatToParts(at).find((p) => p.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
}
