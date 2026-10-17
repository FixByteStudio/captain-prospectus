import { describe, expect, it } from "vitest";
import type { Prospect } from "../../shared/schemas";
import { brusselsMidnightDaysFromNow, brusselsPeriod } from "../../shared/period";
import { decideTourneeGate, holdGate, type GateInput, type TourneeGate } from "./tournee-gate";

const ME = "agent@example.com";
const NOW = Date.UTC(2026, 9, 14, 8, 0, 0);
const DAY_START = brusselsPeriod(NOW, 1).from;
const TOMORROW = brusselsMidnightDaysFromNow(NOW, 1);

const prospect = (over: Partial<Prospect> = {}): Prospect => ({
  id: crypto.randomUUID(),
  name: "Bar des Marolles",
  type: "bar",
  lat: 50.84,
  lng: 4.35,
  address: null,
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

const input = (over: Partial<GateInput> = {}): GateInput => ({
  lastSyncAt: NOW,
  pulled: [],
  outboxTournees: [],
  prospects: [prospect()],
  outboxProspects: [],
  identity: ME,
  now: NOW,
  ...over,
});

const pulledToday = {
  id: crypto.randomUUID(),
  dayStart: DAY_START,
  startedAt: NOW,
  clientStartedAt: NOW,
};

describe("decideTourneeGate", () => {
  it("says never loaded when no pull ever succeeded", () => {
    expect(decideTourneeGate(input({ lastSyncAt: undefined, prospects: [] }))).toEqual({
      kind: "neverLoaded",
    });
  });

  it("says nothing is assigned after a pull with an empty snapshot", () => {
    expect(decideTourneeGate(input({ prospects: [] }))).toEqual({ kind: "nothingAssigned" });
  });

  it("does not count a follow-up due tomorrow as work to start", () => {
    const later = prospect({ status: "follow_up", nextVisitAt: TOMORROW + 3_600_000 });
    expect(decideTourneeGate(input({ prospects: [later] })).kind).toBe("nothingAssigned");
  });

  it("starts with the snapshot when there is work and no tournée today", () => {
    const gate = decideTourneeGate(input({ prospects: [prospect(), prospect()] }));
    expect(gate.kind).toBe("start");
    if (gate.kind === "start") expect(gate.snapshot).toHaveLength(2);
  });

  it("includes this identity's field prospects, and only theirs", () => {
    const field = (writtenBy: string) => ({
      id: crypto.randomUUID(),
      name: "Camion",
      type: "food_truck" as const,
      createdAt: NOW,
      writtenBy,
    });
    const gate = decideTourneeGate(
      input({ prospects: [], outboxProspects: [field(ME), field("other@example.com")] }),
    );
    expect(gate.kind === "start" && gate.snapshot.length).toBe(1);
  });

  it("opens on a pulled tournée with today's dayStart, a second phone or a reinstall", () => {
    expect(decideTourneeGate(input({ pulled: [pulledToday] })).kind).toBe("open");
    expect(
      decideTourneeGate(input({ pulled: [pulledToday], lastSyncAt: undefined, prospects: [] }))
        .kind,
    ).toBe("open");
  });

  it("ignores a pulled tournée of another day", () => {
    const yesterday = { ...pulledToday, dayStart: DAY_START - 86_400_000 };
    expect(decideTourneeGate(input({ pulled: [yesterday] })).kind).toBe("start");
  });

  it("opens on this identity's outbox tournée started today", () => {
    const own = { id: crypto.randomUUID(), startedAt: NOW + 60_000, writtenBy: ME };
    expect(decideTourneeGate(input({ outboxTournees: [own] })).kind).toBe("open");
    const unstamped = { id: crypto.randomUUID(), startedAt: NOW };
    expect(decideTourneeGate(input({ outboxTournees: [unstamped] })).kind).toBe("open");
  });

  it("does not open on another identity's outbox tournée", () => {
    const theirs = { id: crypto.randomUUID(), startedAt: NOW, writtenBy: "other@example.com" };
    expect(decideTourneeGate(input({ outboxTournees: [theirs] })).kind).toBe("start");
  });

  it("does not open on an outbox tournée started yesterday", () => {
    const old = { id: crypto.randomUUID(), startedAt: DAY_START - 3_600_000, writtenBy: ME };
    expect(decideTourneeGate(input({ outboxTournees: [old] })).kind).toBe("start");
  });
});

describe("holdGate", () => {
  const open: TourneeGate = { kind: "open" };
  const start: TourneeGate = { kind: "start", snapshot: [] };
  const loading: TourneeGate = { kind: "loading" };

  it.each<[string, TourneeGate, boolean, boolean, TourneeGate, boolean]>([
    // live, onForm, wasOpen -> gate, wasOpen
    ["remembers an open gate on a form", open, true, false, open, true],
    ["remembers an open gate off a form", open, false, false, open, true],
    ["holds a form entered open when the gate closes under it", start, true, true, open, true],
    ["holds it when the store answers loading again", loading, true, true, open, true],
    [
      "holds it through a nothing-assigned day",
      { kind: "nothingAssigned" },
      true,
      true,
      open,
      true,
    ],
    ["shows the live gate off a form, whatever it was", start, false, true, start, false],
    ["does not hold a form entered while gated: a deep link", start, true, false, start, false],
    ["keeps the held gate while the form stays open", open, true, true, open, true],
  ])("%s", (_name, live, onForm, wasOpen, gate, next) => {
    expect(holdGate(live, onForm, wasOpen)).toEqual({ gate, wasOpen: next });
  });

  it("stops holding once the agent leaves the form", () => {
    const onForm = holdGate(start, true, true);
    expect(holdGate(start, false, onForm.wasOpen)).toEqual({ gate: start, wasOpen: false });
  });
});
