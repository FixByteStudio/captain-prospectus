import { describe, expect, it } from "vitest";
import type { AgentRoundResponse, Prospect } from "../../../shared/schemas";
import { roundMap, roundStops } from "./round-list";

const NOW = Date.UTC(2026, 9, 6, 10, 0);

function prospect(id: string, name: string, lat: number | null, lng: number | null): Prospect {
  return {
    id,
    name,
    type: "restaurant",
    lat,
    lng,
    address: null,
    phone: null,
    website: null,
    cuisine: null,
    source: "csv",
    status: "assigned",
    assignedTo: "lea@example.com",
    lastVisitAt: null,
    nextVisitAt: null,
  };
}

const POSITION = { lat: 50.85, lng: 4.35, accuracy: 10, capturedAt: NOW - 60_000 };

/** Stops 2 and 4 are gone, so the server sends 1, 3 and 5, none of them in distance order. */
function round(position: AgentRoundResponse["position"]): AgentRoundResponse {
  return {
    tournee: {
      startedAt: NOW - 3_600_000,
      stops: [
        { number: 1, prospect: prospect("far", "Zeste", 50.9, 4.4) },
        { number: 3, prospect: prospect("none", "Alpha", null, null) },
        { number: 5, prospect: prospect("near", "Madeleine", 50.8501, 4.3501) },
      ],
    },
    position,
  };
}

describe("roundStops", () => {
  it("keeps the server's order and numbers, gaps included", () => {
    const stops = roundStops(round(POSITION));
    expect(stops?.map((s) => [s.number, s.name])).toEqual([
      [1, "Zeste"],
      [3, "Alpha"],
      [5, "Madeleine"],
    ]);
  });

  it("measures from the position, and leaves a stop without coordinates unmeasured", () => {
    const stops = roundStops(round(POSITION)) ?? [];
    expect(stops[0]?.distanceM).toBeGreaterThan(5_000);
    expect(stops[1]?.distanceM).toBeNull();
    expect(stops[2]?.distanceM).toBeLessThan(200);
  });

  it("has no distances without a position, and still the same order", () => {
    const stops = roundStops(round(null)) ?? [];
    expect(stops.map((s) => s.number)).toEqual([1, 3, 5]);
    expect(stops.every((s) => s.distanceM === null)).toBe(true);
  });

  it("is null before the swipe, and empty when every stop is done", () => {
    expect(roundStops({ tournee: null, position: POSITION })).toBeNull();
    expect(roundStops({ tournee: { startedAt: NOW, stops: [] }, position: null })).toEqual([]);
  });
});

describe("roundMap", () => {
  const at = { lat: 50.85, lng: 4.35 };
  const stops = roundStops(round(POSITION)) ?? [];

  it("pins keep the swipe numbers, the lowest is gold, a stop without coordinates draws none", () => {
    const map = roundMap(stops, at);
    expect(map.pins.map((p) => [p.name, p.number, p.next])).toEqual([
      ["Zeste", 1, true],
      ["Madeleine", 5, false],
    ]);
    expect(map.point).toEqual(at);
  });

  it("the path runs through the pins in number order, not through the position", () => {
    expect(roundMap(stops, at).path).toEqual([
      [50.9, 4.4],
      [50.8501, 4.3501],
    ]);
  });

  it("without a position: the same gold pin and path, and no marker", () => {
    const map = roundMap(roundStops(round(null)) ?? [], null);
    expect(map.pins.map((p) => [p.number, p.next])).toEqual([
      [1, true],
      [5, false],
    ]);
    expect(map.path).toHaveLength(2);
    expect(map.point).toBeNull();
  });

  it("before the swipe: the marker only", () => {
    expect(roundMap([], at)).toEqual({ pins: [], path: [], point: at });
  });
});
