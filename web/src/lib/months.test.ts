import { describe, expect, it } from "vitest";
import { monthTicks } from "./months";

describe("monthTicks", () => {
  it("leaves a short range to the chart, which labels each month", () => {
    expect(monthTicks(["2026-01", "2026-02", "2026-03"])).toBeUndefined();
  });

  it("marks each January on a range over two years, so every year is labelled", () => {
    const months = Array.from({ length: 36 }, (_, i) => {
      const d = new Date(2023, 10 + i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    expect(monthTicks(months)).toEqual(["2024-01", "2025-01", "2026-01"]);
  });
});
