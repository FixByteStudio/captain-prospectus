/**
 * MapCanvas — real Leaflet in happy-dom, as in `RoundMap.test.tsx`;
 * `MapStep.test.tsx` mocks this module instead. happy-dom computes no
 * stacking, so the class is what can be asserted (#446).
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MapCanvas } from "./MapCanvas";

describe("MapCanvas", () => {
  it("isolates its own stacking context so its panes cannot paint over the import dialog (#446)", () => {
    const { container } = render(
      <MapCanvas
        mode="polygon"
        polygon={[]}
        circle={null}
        onMapClick={() => {}}
        onHandleDrag={() => {}}
      />,
    );

    const surface = container.querySelector('[role="application"]');
    expect(surface?.className).toContain("isolate");
  });
});
