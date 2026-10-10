/**
 * The vendored Progress hands `value` to the Radix root, so assistive
 * technology gets the same figure the fill shows (GH #147, ADR-0014).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Progress } from "./progress";

describe("Progress", () => {
  it("announces its value and fills to it", () => {
    render(<Progress value={40} aria-label="bar" />);

    const bar = screen.getByRole("progressbar", { name: "bar" });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("data-state")).toBe("loading");
    const indicator = bar.querySelector<HTMLElement>('[data-slot="progress-indicator"]');
    expect(indicator?.style.transform).toBe("translateX(-60%)");
  });

  it("is complete at 100 and loading at 0", () => {
    const { rerender } = render(<Progress value={100} aria-label="bar" />);
    const bar = screen.getByRole("progressbar", { name: "bar" });
    expect(bar.getAttribute("data-state")).toBe("complete");

    rerender(<Progress value={0} aria-label="bar" />);
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(bar.getAttribute("data-state")).toBe("loading");
  });

  it("stays indeterminate only when given no value", () => {
    render(<Progress aria-label="bar" />);

    const bar = screen.getByRole("progressbar", { name: "bar" });
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.getAttribute("data-state")).toBe("indeterminate");
  });

  it("is gold by default and ink on request", () => {
    const fill = (name: string) =>
      screen
        .getByRole("progressbar", { name })
        .querySelector<HTMLElement>('[data-slot="progress-indicator"]')?.className;
    render(
      <>
        <Progress value={10} aria-label="gold" />
        <Progress value={10} variant="ink" aria-label="ink" />
      </>,
    );

    expect(fill("gold")).toContain("bg-primary");
    expect(fill("ink")).toContain("bg-foreground");
    expect(fill("ink")).not.toContain("bg-primary");
  });
});
