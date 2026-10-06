import { describe, expect, it } from "vitest";
import type { AgentRoundResponse, Prospect } from "../../../shared/schemas";
import { buildTodayList } from "../../../shared/today";
import { roundStops } from "./round-list";

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
