/**
 * The progress line and bar render exactly what `tourneeCounter` computed
 * (GH #119) — nothing here re-derives `n`/`total` from Dexie, only the
 * component's own rendering of the `progress` prop it is handed.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { copy } from "../copy";
import { DailyProgress } from "./DailyProgress";

describe("DailyProgress", () => {
  it("renders nothing when there is nothing to count", () => {
    const { container } = render(<DailyProgress progress={{ n: 0, total: 0, percent: 0 }} />);

    expect(container.firstChild).toBeNull();
  });

  it("shows the line and a labelled bar filled to the percentage", () => {
    render(<DailyProgress progress={{ n: 2, total: 5, percent: 40 }} />);

    const n = screen.getByText("2");
    // The bar's label is the one accessible name: the visible text is hidden.
    expect(n.closest("p")?.getAttribute("aria-hidden")).toBe("true");
    expect(n.className).toMatch(/text-display/);
    const of = screen.getByText(copy.today.progressOf(5));
    expect(of.className).toMatch(/font-semibold/);

    const bar = screen.getByLabelText(copy.today.progressLabel(2, 5));
    // The mock's track is `--secondary`; the vendored default is
    // `bg-primary/20` (the gold fill's own colour), which is the failure mode
    // a `cn` merge could reintroduce silently.
    expect(bar.className).toMatch(/bg-secondary/);

    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    const indicator = bar.querySelector('[data-slot="progress-indicator"]');
    expect(indicator).not.toBeNull();
    expect((indicator as HTMLElement).className).toContain("bg-primary");
    expect((indicator as HTMLElement).style.transform).toBe("translateX(-60%)");
  });

  it("names the bar in arrêts, singular for 0 and 1", () => {
    expect(copy.today.progressLabel(0, 20)).toBe("0 arrêt fait sur 20");
    expect(copy.today.progressLabel(1, 20)).toBe("1 arrêt fait sur 20");
    expect(copy.today.progressLabel(15, 20)).toBe("15 arrêts faits sur 20");
  });
});
