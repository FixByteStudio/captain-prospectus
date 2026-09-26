/**
 * The sparkline's Y domain — GH #111. Recharts draws nothing at happy-dom's
 * 0 width, so the scaling is tested as the pure function the chart reads.
 */
import { describe, expect, it } from "vitest";
import { sparklineDomain } from "./KpiSparkline";

describe("sparklineDomain", () => {
  it("scales to the period's own min and max, not from 0", () => {
    expect(sparklineDomain([12, 18, 15, 30, 21])).toEqual([12, 30]);
  });

  it.each([[[7, 7, 7]], [[0, 0, 0, 0, 0, 0, 0]], [[4]]])(
    "puts a flat series %j at mid-height rather than dividing by zero",
    (byDay) => {
      const [low, high] = sparklineDomain(byDay);
      const value = byDay[0] ?? 0;
      expect(high).toBeGreaterThan(low);
      expect((value - low) / (high - low)).toBe(0.5);
    },
  );

  it("has a finite range with no days at all", () => {
    expect(sparklineDomain([])).toEqual([-1, 1]);
  });
});
