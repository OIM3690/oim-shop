import { describe, expect, it } from "vitest";
import { formatCount, formatDate, formatMoney, formatPercent } from "./format";

describe("format", () => {
  it("shows dollars with cents and thousands separators", () => {
    expect(formatMoney(14557.4)).toBe("$14,557.40");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("shows counts with thousands separators", () => {
    expect(formatCount(15315)).toBe("15,315");
  });

  it("shows a discount as a whole percent", () => {
    expect(formatPercent(0.25)).toBe("25%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("shows the calendar date of a timestamp or a date", () => {
    expect(formatDate("2026-10-22T14:59:35")).toBe("Oct 22, 2026");
    // A bare date must not move to the day before in time zones west of UTC.
    expect(formatDate("2016-01-02")).toBe("Jan 2, 2016");
  });
});
