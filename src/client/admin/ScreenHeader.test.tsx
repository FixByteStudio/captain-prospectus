import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScreenHeader } from "./ScreenHeader";

describe("ScreenHeader", () => {
  it("renders the title alone", () => {
    render(<ScreenHeader title="Prospects" />);

    expect(screen.getByRole("heading", { name: "Prospects" })).toBeTruthy();
  });

  it("renders an optional subtitle under the title", () => {
    render(<ScreenHeader title="Scripts" subtitle="Une question par ligne." />);

    expect(screen.getByText("Une question par ligne.")).toBeTruthy();
  });

  it("renders optional actions", () => {
    render(<ScreenHeader title="Visites" actions={<button type="button">Exporter</button>} />);

    expect(screen.getByRole("button", { name: "Exporter" })).toBeTruthy();
  });

  it("lets a caller keep its own subtitle classes", () => {
    render(
      <ScreenHeader
        title="Scripts"
        subtitle={<p className="max-w-2xl text-sm">Une question par ligne.</p>}
      />,
    );

    expect(screen.getByText("Une question par ligne.").className).toBe("max-w-2xl text-sm");
  });

  it("aligns the title and actions on their text baseline with no subtitle", () => {
    render(
      <ScreenHeader title="Prospects" actions={<span data-testid="count">3 prospects</span>} />,
    );

    expect(screen.getByTestId("count").closest("header")?.className).toMatch(/items-baseline/);
  });

  it("aligns the title block's box, not its baseline, once there is a subtitle", () => {
    render(<ScreenHeader title="Scripts" subtitle="Une question par ligne." />);

    expect(screen.getByRole("heading").closest("header")?.className).toMatch(/items-end/);
  });
});
