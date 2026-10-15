import { describe, expect, it } from "vitest";
import { OPEN_STATUSES, STATUSES } from "./constants";
import { brusselsMidnightDaysFromNow } from "./period";
import type { FieldProspect, Prospect } from "./schemas";
import { isStopLeft, numberStops, snapshotProspects } from "./tournee";

const ME = "agent@example.com";

describe("isStopLeft", () => {
  it("keeps an open stop the agent still owns", () => {
    for (const status of OPEN_STATUSES) {
      expect(isStopLeft({ assignedTo: ME, status, mergedInto: null }, ME, false)).toBe(false);
    }
  });

  it("leaves when the prospect is closed, unvisited", () => {
    for (const status of STATUSES.filter((s) => !OPEN_STATUSES.includes(s))) {
      expect(isStopLeft({ assignedTo: ME, status, mergedInto: null }, ME, false)).toBe(true);
    }
  });

  it("leaves when reassigned or unassigned, unvisited", () => {
    expect(
      isStopLeft(
        { assignedTo: "other@example.com", status: "assigned", mergedInto: null },
        ME,
        false,
      ),
    ).toBe(true);
    expect(isStopLeft({ assignedTo: null, status: "new", mergedInto: null }, ME, false)).toBe(true);
  });

  it("leaves when merged away, unvisited", () => {
    expect(isStopLeft({ assignedTo: ME, status: "assigned", mergedInto: "x" }, ME, false)).toBe(
      true,
    );
  });

  it("never leaves once visited today, whatever happened to the prospect", () => {
    expect(isStopLeft({ assignedTo: ME, status: "converted", mergedInto: null }, ME, true)).toBe(
      false,
    );
    expect(
      isStopLeft(
        { assignedTo: "other@example.com", status: "assigned", mergedInto: "x" },
        ME,
        true,
      ),
    ).toBe(false);
    expect(isStopLeft({ assignedTo: null, status: "rejected", mergedInto: null }, ME, true)).toBe(
      false,
    );
  });
});

const NOW = Date.UTC(2026, 9, 14, 8, 0, 0);
const TOMORROW = brusselsMidnightDaysFromNow(NOW, 1);

const prospect = (over: Partial<Prospect> = {}): Prospect => ({
  id: crypto.randomUUID(),
  name: "Bar des Marolles",
  type: "bar",
  lat: 50.84,
  lng: 4.35,
  address: "Place du Jeu de Balle",
  phone: null,
  website: null,
  cuisine: null,
  source: "csv",
  status: "assigned",
  assignedTo: ME,
  lastVisitAt: null,
  nextVisitAt: null,
  ...over,
});

const fieldProspect = (over: Partial<FieldProspect> = {}): FieldProspect => ({
  id: crypto.randomUUID(),
  name: "Food truck Flagey",
  type: "food_truck",
  createdAt: NOW,
  ...over,
});

describe("snapshotProspects", () => {
  it("takes the open prospects and leaves the closed ones", () => {
    const open = [prospect({ status: "new" }), prospect({ status: "assigned" })];
    const closed = [prospect({ status: "converted" }), prospect({ status: "rejected" })];
    const ids = snapshotProspects([...open, ...closed], [], NOW).map((p) => p.id);
    expect(ids).toEqual(open.map((p) => p.id));
  });

  it("holds a follow-up due today or earlier, and not one due tomorrow", () => {
    const dueToday = prospect({ status: "follow_up", nextVisitAt: NOW + 8 * 3_600_000 });
    const overdue = prospect({ status: "follow_up", nextVisitAt: NOW - 86_400_000 });
    const undated = prospect({ status: "follow_up", nextVisitAt: null });
    const tomorrow = prospect({ status: "follow_up", nextVisitAt: TOMORROW + 9 * 3_600_000 });
    const atMidnight = prospect({ status: "follow_up", nextVisitAt: TOMORROW });
    const ids = snapshotProspects([dueToday, overdue, undated, tomorrow, atMidnight], [], NOW).map(
      (p) => p.id,
    );
    expect(ids).toEqual([dueToday.id, overdue.id, undated.id]);
  });

  it("adds the field prospects still in the outbox, once", () => {
    const pulled = prospect();
    const field = fieldProspect({ lat: null, address: undefined });
    const both = fieldProspect({ id: pulled.id });
    const snapshot = snapshotProspects([pulled], [field, both], NOW);
    expect(snapshot.map((p) => p.id)).toEqual([pulled.id, field.id]);
    expect(snapshot[1]).toMatchObject({ lat: null, lng: null, address: null });
  });

  it("is empty with nothing assigned", () => {
    expect(snapshotProspects([], [], NOW)).toEqual([]);
  });
});

describe("numberStops", () => {
  const at = (lat: number, lng: number | null) => ({ lat, lng });

  it("numbers nearest-next from the reading, from 1", () => {
    const far = at(50.9, 4.5);
    const near = at(50.841, 4.351);
    const mid = at(50.85, 4.36);
    const numbered = numberStops([far, mid, near], { lat: 50.84, lng: 4.35 });
    expect(numbered.map((n) => n.number)).toEqual([1, 2, 3]);
    expect(numbered.map((n) => n.item)).toEqual([near, mid, far]);
  });

  it("puts unlocated stops last, in input order", () => {
    const a = { lat: null, lng: null, id: "a" };
    const b = { lat: 50.84, lng: 4.35, id: "b" };
    const c = { lat: null, lng: null, id: "c" };
    const numbered = numberStops([a, b, c], { lat: 50, lng: 4 });
    expect(numbered.map((n) => n.item.id)).toEqual(["b", "a", "c"]);
  });

  it("starts at the number it is given", () => {
    const numbered = numberStops([at(50.84, 4.35), at(50.85, 4.36)], { lat: 50, lng: 4 }, 21);
    expect(numbered.map((n) => n.number)).toEqual([21, 22]);
  });
});
