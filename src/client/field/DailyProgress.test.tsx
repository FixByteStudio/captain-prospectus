/**
 * The progress line and bar render exactly what `dailyProgress` computed
 * (GH #119) — nothing here re-derives `n`/`total` from Dexie, only the
 * component's own rendering of the `progress` prop it is handed.
 */
import { describe, expect, it, vi } from "vitest";
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

    expect(screen.getByText(copy.today.progress(2, 5))).toBeTruthy();

    const bar = screen.getByLabelText(copy.today.progressLabel);
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

  it("caps the bar at full when a stop was visited twice", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<DailyProgress progress={{ n: 2, total: 1, percent: 200 }} />);

    const bar = screen.getByLabelText(copy.today.progressLabel);
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect(bar.getAttribute("data-state")).toBe("complete");
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
