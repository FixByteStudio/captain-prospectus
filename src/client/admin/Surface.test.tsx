import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Surface } from "./Surface";

describe("Surface", () => {
  it("renders its children inside the panel chrome", () => {
    render(<Surface>Contenu</Surface>);

    expect(screen.getByText("Contenu")).toBeTruthy();
  });

  it("carries the hand-spelled panel border, filled, with no padding", () => {
    render(<Surface data-testid="surface">Contenu</Surface>);

    const surface = screen.getByTestId("surface");
    expect(surface.className).toMatch(/rounded-md/);
    expect(surface.className).toMatch(/border-border/);
    expect(surface.className).toMatch(/bg-card/);
    expect(surface.className).not.toMatch(/\bp-\d/);
  });

  it("lets a caller extend its className without losing the chrome", () => {
    render(
      <Surface data-testid="surface" className="lg:col-span-2">
        Contenu
      </Surface>,
    );

    const surface = screen.getByTestId("surface");
    expect(surface.className).toMatch(/lg:col-span-2/);
    expect(surface.className).toMatch(/rounded-md/);
  });
});
