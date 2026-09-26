/**
 * RoundMap — spec-gh-121 matrix, "Online round" and "Re-centre". Real Leaflet
 * in happy-dom (spiked first: it creates a map, draws markers, an SVG
 * polyline and an attribution control with no network request, so a fake
 * standing in for it would prove less than the real thing does here) —
 * `vi.mock("./RoundMap")` is what `CarteScreen.test.tsx` does instead.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import L from "leaflet";
import { copy } from "../copy";
import type { MapPin } from "./round-map";
import { RoundMap } from "./RoundMap";

/** Matches `RECENTRE_TIMEOUT_MS` in `RoundMap.tsx` — not exported, since
 * nothing outside the module needs it; the fake-timer tests below advance by
 * this literal instead. */
const RECENTRE_TIMEOUT_MS = 10_000;

const pin = (over: Partial<MapPin> = {}): MapPin => ({
  id: crypto.randomUUID(),
  index: 1,
  lat: 50.85,
  lng: 4.35,
  next: false,
  name: "Curry House",
  ...over,
});

function markerIcons(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".leaflet-marker-icon"));
}

/** The first marker, asserted to exist rather than indexed with `!` — a
 * missing one is exactly the failure the selection tests below check for. */
function firstMarker(container: HTMLElement): HTMLElement {
  const marker = markerIcons(container).at(0);
  if (!marker) throw new Error("no marker was drawn");
  return marker;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RoundMap", () => {
  it("draws one marker per pin: gold 34px only for `next`, card 28px for the rest", () => {
    const pins = [
      pin({ index: 1, lat: 1, lng: 2, next: true }),
      pin({ index: 2, lat: 3, lng: 4, next: false }),
    ];
    const { container } = render(
      <RoundMap pins={pins} path={[]} position={null} recentre={() => {}} />,
    );

    const markers = markerIcons(container);
    expect(markers).toHaveLength(2);

    const gold = markers.find((el) => el.textContent === "1");
    const card = markers.find((el) => el.textContent === "2");
    expect(gold?.querySelector("span")?.className).toContain("bg-primary");
    expect(gold?.style.width).toBe("34px");
    expect(card?.querySelector("span")?.className).toContain("bg-card");
    expect(card?.style.width).toBe("28px");
  });

  it("draws the dashed gold path through the stops", () => {
    const { container } = render(
      <RoundMap
        pins={[pin({ lat: 1, lng: 2 }), pin({ lat: 3, lng: 4 })]}
        path={[
          [1, 2],
          [3, 4],
        ]}
        position={null}
        recentre={() => {}}
      />,
    );

    const path = container.querySelector("path.leaflet-interactive");
    expect(path).toBeTruthy();
    expect(path?.getAttribute("stroke-width")).toBe("3");
    expect(path?.getAttribute("stroke-dasharray")).toBe("7 6");
  });

  it("draws a position marker only when a position is given", () => {
    const { container: withoutPosition } = render(
      <RoundMap pins={[]} path={[]} position={null} recentre={() => {}} />,
    );
    expect(markerIcons(withoutPosition)).toHaveLength(0);

    const { container: withPosition } = render(
      <RoundMap pins={[]} path={[]} position={{ lat: 5, lng: 6 }} recentre={() => {}} />,
    );
    const markers = markerIcons(withPosition);
    expect(markers).toHaveLength(1);
    expect(markers.at(0)?.innerHTML).toContain("bg-foreground/20");
  });

  it("shows the OSM attribution with Leaflet's own prefix dropped", () => {
    const { container } = render(
      <RoundMap pins={[]} path={[]} position={null} recentre={() => {}} />,
    );

    const attribution = container.querySelector(".leaflet-control-attribution");
    // Leaflet's default prefix is a "Leaflet" credit link; `setPrefix(false)`
    // drops it, so only `copy.attribution` remains — a stray prefix here would
    // be invariant 11's OSM line sharing its home with an uncredited "Leaflet".
    expect(attribution?.textContent).toBe(copy.attribution);
  });

  it("tiles from OpenStreetMap", () => {
    const tileLayer = vi.spyOn(L, "tileLayer");

    render(<RoundMap pins={[]} path={[]} position={null} recentre={() => {}} />);

    expect(tileLayer).toHaveBeenCalledWith(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      expect.objectContaining({ attribution: copy.attribution, maxZoom: 19 }),
    );
  });

  it("fits the initial view to the pins and the position", () => {
    const fitBounds = vi.spyOn(L.Map.prototype, "fitBounds");
    const pins = [pin({ lat: 1, lng: 2 }), pin({ lat: 3, lng: 4 })];

    render(
      <RoundMap
        pins={pins}
        path={[
          [1, 2],
          [3, 4],
        ]}
        position={{ lat: 5, lng: 6 }}
        recentre={() => {}}
      />,
    );

    expect(fitBounds).toHaveBeenCalledWith(
      [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
      expect.objectContaining({ padding: [40, 40] }),
    );
  });

  it("centres on the one known point when there are no pins (matrix: Empty round)", () => {
    const setView = vi.spyOn(L.Map.prototype, "setView");

    render(<RoundMap pins={[]} path={[]} position={{ lat: 5, lng: 6 }} recentre={() => {}} />);

    expect(setView).toHaveBeenCalledWith([5, 6], 16);
  });

  it("falls back to the Brussels default with no pins and no position", () => {
    const setView = vi.spyOn(L.Map.prototype, "setView");

    render(<RoundMap pins={[]} path={[]} position={null} recentre={() => {}} />);

    expect(setView).toHaveBeenCalledWith([50.8467, 4.3525], 14);
  });

  it("isolates its own stacking context so its panes cannot paint over sibling controls", () => {
    const { container } = render(
      <RoundMap pins={[]} path={[]} position={null} recentre={() => {}} />,
    );

    const surface = container.querySelector('[role="application"]');
    expect(surface?.className).toContain("isolate");
  });
});

describe("RoundMap selection (spec-gh-122)", () => {
  it("names each marker and calls onSelect(id) on a click, when onSelect is given", () => {
    const onSelect = vi.fn();
    const pins = [pin({ id: "a", index: 1, name: "Curry House" })];
    const { container } = render(
      <RoundMap pins={pins} path={[]} position={null} recentre={() => {}} onSelect={onSelect} />,
    );

    const marker = firstMarker(container);
    expect(marker.getAttribute("title")).toBe(copy.carte.pinLabel(1, "Curry House"));
    expect(marker.getAttribute("role")).toBe("button");
    expect(marker.className).toContain("leaflet-interactive");

    fireEvent.click(marker);
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("leaves markers non-interactive and untitled with no onSelect", () => {
    const pins = [pin({ id: "a" })];
    const { container } = render(
      <RoundMap pins={pins} path={[]} position={null} recentre={() => {}} />,
    );

    const marker = firstMarker(container);
    expect(marker.getAttribute("title")).toBeNull();
    expect(marker.className).not.toContain("leaflet-interactive");
  });

  it.each(["Enter", " "])("calls onSelect(id) when %j is pressed on a focused marker", (key) => {
    const onSelect = vi.fn();
    const pins = [pin({ id: "a" })];
    const { container } = render(
      <RoundMap pins={pins} path={[]} position={null} recentre={() => {}} onSelect={onSelect} />,
    );

    const marker = firstMarker(container);
    fireEvent.keyDown(marker, { key });

    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("ignores any other key on a focused marker", () => {
    const onSelect = vi.fn();
    const pins = [pin({ id: "a" })];
    const { container } = render(
      <RoundMap pins={pins} path={[]} position={null} recentre={() => {}} onSelect={onSelect} />,
    );

    fireEvent.keyDown(firstMarker(container), { key: "Tab" });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not count a pin tap as the agent's own hand on the map: auto-fit keeps following", () => {
    const onSelect = vi.fn();
    const fitBounds = vi.spyOn(L.Map.prototype, "fitBounds");
    const pins = [pin({ id: "a", lat: 1, lng: 2 }), pin({ id: "b", lat: 3, lng: 4 })];
    const { container, rerender } = render(
      <RoundMap pins={pins} path={[]} position={null} recentre={() => {}} onSelect={onSelect} />,
    );
    fitBounds.mockClear();

    const marker = firstMarker(container);
    fireEvent.click(marker);
    expect(onSelect).toHaveBeenCalledWith("a");

    const newPins = [pin({ id: "a", lat: 9, lng: 9 }), pin({ id: "b", lat: 10, lng: 10 })];
    rerender(
      <RoundMap pins={newPins} path={[]} position={null} recentre={() => {}} onSelect={onSelect} />,
    );

    // A hand move (`movestart` firing with no `programmaticMove` flag) would
    // have stopped this — see "RoundMap auto-fit" above.
    expect(fitBounds).toHaveBeenCalled();
  });
});

describe("RoundMap resize (spec-gh-122, matrix: Resize)", () => {
  class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    callback: ResizeObserverCallback;
    observed: Element[] = [];
    disconnected = false;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      FakeResizeObserver.instances.push(this);
    }
    observe(target: Element) {
      this.observed.push(target);
    }
    unobserve() {}
    disconnect() {
      this.disconnected = true;
    }
  }

  it("observes its own container and invalidates the map's size when it resizes, disconnecting on unmount", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);

    try {
      const invalidateSize = vi
        .spyOn(L.Map.prototype, "invalidateSize")
        .mockImplementation(function (this: L.Map) {
          return this;
        });

      const { container, unmount } = render(
        <RoundMap pins={[]} path={[]} position={null} recentre={() => {}} />,
      );

      const observer = FakeResizeObserver.instances.at(-1);
      if (!observer) throw new Error("no ResizeObserver was created");
      const surface = container.querySelector('[role="application"]');
      expect(observer.observed).toEqual([surface]);

      observer.callback([], observer as unknown as ResizeObserver);
      expect(invalidateSize).toHaveBeenCalled();

      expect(observer.disconnected).toBe(false);
      unmount();
      expect(observer.disconnected).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("RoundMap auto-fit", () => {
  it("keeps fitting a changing round until the agent moves the map by hand", () => {
    const setView = vi.spyOn(L.Map.prototype, "setView");
    const fitBounds = vi.spyOn(L.Map.prototype, "fitBounds");

    const { rerender } = render(
      <RoundMap pins={[]} path={[]} position={null} recentre={() => {}} />,
    );
    // Empty round, no position yet (a live query and a one-shot reading both
    // still settling on a real load): the Brussels default, not stuck there.
    expect(setView).toHaveBeenLastCalledWith([50.8467, 4.3525], 14);

    const pins = [pin({ lat: 1, lng: 2 }), pin({ lat: 3, lng: 4 })];
    rerender(<RoundMap pins={pins} path={[]} position={null} recentre={() => {}} />);
    expect(fitBounds).toHaveBeenLastCalledWith(
      [
        [1, 2],
        [3, 4],
      ],
      expect.objectContaining({ padding: [40, 40] }),
    );

    rerender(<RoundMap pins={pins} path={[]} position={{ lat: 5, lng: 6 }} recentre={() => {}} />);
    expect(fitBounds).toHaveBeenLastCalledWith(
      [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
      expect.objectContaining({ padding: [40, 40] }),
    );
  });

  it("stops auto-fitting once a hand move fires, even when the pins then change", () => {
    const fitBounds = vi.spyOn(L.Map.prototype, "fitBounds");
    const realMap = L.map.bind(L);
    let instance: L.Map | undefined;
    vi.spyOn(L, "map").mockImplementation((el, options) => {
      instance = realMap(el, options);
      return instance;
    });

    const pins = [pin({ lat: 1, lng: 2 }), pin({ lat: 3, lng: 4 })];
    const { rerender } = render(
      <RoundMap pins={pins} path={[]} position={null} recentre={() => {}} />,
    );
    expect(fitBounds).toHaveBeenCalledTimes(1);

    // A real drag fires `movestart` with no `programmaticMove` flag around it
    // — this is that, without simulating actual pointer events.
    instance?.fire("movestart");

    const newPins = [pin({ lat: 9, lng: 9 }), pin({ lat: 10, lng: 10 })];
    rerender(<RoundMap pins={newPins} path={[]} position={null} recentre={() => {}} />);

    expect(fitBounds).toHaveBeenCalledTimes(1);
  });
});

describe("RoundMap re-centre bookkeeping", () => {
  it("fits the pins and the known position after the fallback, and still pans a reading that lands late", () => {
    vi.useFakeTimers();
    try {
      const recentre = vi.fn();
      const fitBounds = vi.spyOn(L.Map.prototype, "fitBounds");
      const panTo = vi.spyOn(L.Map.prototype, "panTo");
      const pins = [pin({ lat: 1, lng: 2 }), pin({ lat: 3, lng: 4 })];
      const { rerender } = render(
        <RoundMap pins={pins} path={[]} position={{ lat: 5, lng: 6 }} recentre={recentre} />,
      );
      fitBounds.mockClear(); // drop the initial-view fit; only the tap matters here

      fireEvent.click(screen.getByRole("button", { name: copy.carte.recentre }));
      expect(panTo).not.toHaveBeenCalled(); // nothing landed yet

      vi.advanceTimersByTime(RECENTRE_TIMEOUT_MS);

      // The fallback fits pins *and* the position already known — never the
      // pins alone, which would drop a perfectly good position to Brussels.
      expect(fitBounds).toHaveBeenCalledWith(
        [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
        expect.objectContaining({ padding: [40, 40] }),
      );

      // A reading that lands after the fallback already fired still pans:
      // `pendingRecentre` survives the fallback, it does not clear it.
      rerender(
        <RoundMap pins={pins} path={[]} position={{ lat: 9, lng: 10 }} recentre={recentre} />,
      );
      expect(panTo).toHaveBeenCalledWith([9, 10]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still pans a reading that lands after a no-position tap", () => {
    const recentre = vi.fn();
    const panTo = vi.spyOn(L.Map.prototype, "panTo");
    const { rerender } = render(
      <RoundMap pins={[]} path={[]} position={null} recentre={recentre} />,
    );

    fireEvent.click(screen.getByRole("button", { name: copy.carte.recentre }));

    rerender(<RoundMap pins={[]} path={[]} position={{ lat: 9, lng: 10 }} recentre={recentre} />);

    expect(panTo).toHaveBeenCalledWith([9, 10]);
  });
});

describe("RoundMap re-centre", () => {
  it("asks for a fresh reading, and pans once one arrives as a prop", async () => {
    const user = userEvent.setup();
    const recentre = vi.fn();
    const panTo = vi.spyOn(L.Map.prototype, "panTo");
    const { rerender } = render(
      <RoundMap pins={[]} path={[]} position={{ lat: 1, lng: 2 }} recentre={recentre} />,
    );

    await user.click(screen.getByRole("button", { name: copy.carte.recentre }));

    expect(recentre).toHaveBeenCalledTimes(1);
    // Nothing to pan to yet: the tap only asked, it did not already know where.
    expect(panTo).not.toHaveBeenCalled();

    rerender(<RoundMap pins={[]} path={[]} position={{ lat: 9, lng: 10 }} recentre={recentre} />);

    expect(panTo).toHaveBeenCalledWith([9, 10]);
  });

  it("fits the pins at once when there is no position to ask again from", async () => {
    const user = userEvent.setup();
    const recentre = vi.fn();
    const fitBounds = vi.spyOn(L.Map.prototype, "fitBounds");
    const pins = [pin({ lat: 1, lng: 2 }), pin({ lat: 3, lng: 4 })];
    render(<RoundMap pins={pins} path={[]} position={null} recentre={recentre} />);
    // Mount already fit once (the initial-view effect); only the tap's own
    // call matters here.
    fitBounds.mockClear();

    await user.click(screen.getByRole("button", { name: copy.carte.recentre }));

    expect(recentre).toHaveBeenCalledTimes(1);
    expect(fitBounds).toHaveBeenCalledWith(
      [
        [1, 2],
        [3, 4],
      ],
      expect.objectContaining({ padding: [40, 40] }),
    );
  });
});
