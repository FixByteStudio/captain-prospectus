import { describe, expect, it } from "vitest";
import type { AgentRoundResponse, Prospect } from "../../../shared/schemas";
import { buildTodayList } from "../../../shared/today";
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

const PROSPECTS = [
  prospect("far", "Zeste", 50.9, 4.4),
  prospect("none", "Alpha", null, null),
  prospect("near", "Madeleine", 50.8501, 4.3501),
];
const POSITION = { lat: 50.85, lng: 4.35, accuracy: 10, capturedAt: NOW - 60_000 };

describe("roundStops", () => {
  it("keeps the shared rule's order when a position exists", () => {
    const data: AgentRoundResponse = { prospects: PROSPECTS, position: POSITION };
    const expected = buildTodayList(PROSPECTS, [], POSITION, NOW).now.map((s) => s.id);
    const ids = roundStops(data, NOW).map((s) => s.id);
    expect(ids).toEqual(expected);
    expect(ids).toEqual(["near", "far", "none"]);
  });

  it("sorts by name, without distances, when there is no position", () => {
    const stops = roundStops({ prospects: PROSPECTS, position: null }, NOW);
    expect(stops.map((s) => s.name)).toEqual(["Alpha", "Madeleine", "Zeste"]);
    expect(stops.every((s) => s.distanceM === null)).toBe(true);
  });

  it("leaves out a follow-up that is not due today", () => {
    const later: Prospect = {
      ...prospect("later", "Later", 50.85, 4.35),
      status: "follow_up",
      nextVisitAt: NOW + 3 * 86_400_000,
    };
    const stops = roundStops({ prospects: [...PROSPECTS, later], position: POSITION }, NOW);
    expect(stops.map((s) => s.id)).not.toContain("later");
  });
});

describe("roundMap", () => {
  const stops = roundStops({ prospects: PROSPECTS, position: null }, NOW);
  const at = { lat: 50.85, lng: 4.35 };

  it("with a position: list numbers, gold first pin, path, point", () => {
    const ordered = roundStops(
      { prospects: PROSPECTS, position: { ...at, accuracy: 5, capturedAt: NOW } },
      NOW,
    );
    const map = roundMap(ordered, at);
    expect(map.pins.map((p) => [p.name, p.index, p.next])).toEqual([
      ["Madeleine", 1, true],
      ["Zeste", 2, false],
    ]);
    expect(map.path).toHaveLength(2);
    expect(map.point).toEqual(at);
  });

  it("without a position: no gold, empty path, null point", () => {
    const map = roundMap(stops, null);
    expect(map.pins.every((p) => !p.next)).toBe(true);
    expect(map.path).toEqual([]);
    expect(map.point).toBeNull();
  });

  it("a stop without coordinates keeps its number and draws no pin", () => {
    const map = roundMap(stops, null);
    expect(map.pins.map((p) => [p.name, p.index])).toEqual([
      ["Madeleine", 2],
      ["Zeste", 3],
    ]);
  });

  it("with a position: the path is the pins' coordinates in order, not the position", () => {
    const ordered = roundStops(
      { prospects: PROSPECTS, position: { ...at, accuracy: 5, capturedAt: NOW } },
      NOW,
    );
    expect(roundMap(ordered, at).path).toEqual([
      [50.8501, 4.3501],
      [50.9, 4.4],
    ]);
  });

  it("without a position: a coordinated first stop is not gold", () => {
    const first = [prospect("a", "Alpha", 50.8, 4.3), prospect("z", "Zeste", 50.9, 4.4)];
    const list = roundStops({ prospects: first, position: null }, NOW);
    const map = roundMap(list, null);
    expect(map.pins[0]).toEqual(expect.objectContaining({ name: "Alpha", index: 1, next: false }));
  });
});
