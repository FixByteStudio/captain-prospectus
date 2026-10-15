import { describe, expect, it } from "vitest";
import { TOURNEE_STOP_NUMBER_MAX } from "../../shared/constants";
import type { Prospect } from "../../shared/schemas";
import { brusselsMidnightDaysFromNow } from "../../shared/period";
import type { StoredFieldProspect } from "./db";
import { joinersFor } from "./tournee-joiners";

const ME = "a@example.com";
const NOW = 1_700_000_000_000;
const TOURNEE = { id: "00000000-0000-4000-8000-000000000001" };

const prospect = (over: Partial<Prospect> = {}): Prospect => ({
  id: crypto.randomUUID(),
  name: "Le Bouchon",
  type: "restaurant",
  lat: 50.85,
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

const fieldProspect = (over: Partial<StoredFieldProspect> = {}): StoredFieldProspect => ({
  id: crypto.randomUUID(),
  name: "Food truck du pont",
  type: "food_truck",
  lat: null,
  lng: null,
  address: null,
  phone: null,
  createdAt: NOW,
  writtenBy: ME,
  ...over,
});

const join = (over: Partial<Parameters<typeof joinersFor>[0]> = {}) =>
  joinersFor({
    tournee: TOURNEE,
    stops: [],
    prospects: [],
    outboxProspects: [],
    identity: ME,
    now: NOW,
    ...over,
  });

describe("joinersFor", () => {
  it("appends two newcomers after stop 20, nearest-next from stop 20's coordinates", () => {
    const held = Array.from({ length: 20 }, (_, i) =>
      prospect({ name: `P${i + 1}`, lat: 50.8 + i * 0.001, lng: 4.3 }),
    );
    const near = prospect({ name: "Near", lat: 50.8195, lng: 4.3 });
    const far = prospect({ name: "Far", lat: 50.95, lng: 4.3 });

    const joiners = join({
      stops: held.map((p, i) => ({ prospectId: p.id, number: i + 1 })),
      prospects: [...held, far, near],
    });

    expect(joiners.map((j) => [j.number, j.prospectId])).toEqual([
      [21, near.id],
      [22, far.id],
    ]);
    expect(joiners.every((j) => j.tourneeId === TOURNEE.id && j.addedAt === NOW)).toBe(true);
    expect(new Set(joiners.map((j) => j.id)).size).toBe(2);
  });

  it("keeps the gap: the highest number counts a stop that left", () => {
    const [a, b] = [prospect(), prospect()];
    const newcomer = prospect();
    // 19 left (its prospect is no longer open), 20 is the highest.
    const joiners = join({
      stops: [
        { prospectId: a.id, number: 19 },
        { prospectId: b.id, number: 20 },
      ],
      prospects: [prospect({ id: b.id }), newcomer],
    });

    expect(joiners.map((j) => j.number)).toEqual([21]);
  });

  it("never joins a prospect already among the stops, left or reassigned back", () => {
    const [a, b] = [prospect(), prospect()];
    const joiners = join({
      stops: [{ prospectId: a.id, number: 7 }],
      prospects: [a, b],
    });

    expect(joiners.map((j) => j.prospectId)).toEqual([b.id]);
    expect(joiners.map((j) => j.number)).toEqual([8]);
  });

  it("takes a queued field prospect, and not another identity's", () => {
    const mine = fieldProspect({ name: "Mine" });
    const theirs = fieldProspect({ name: "Theirs", writtenBy: "b@example.com" });
    const joiners = join({
      stops: [{ prospectId: crypto.randomUUID(), number: 3 }],
      outboxProspects: [mine, theirs],
    });

    expect(joiners.map((j) => [j.prospectId, j.number])).toEqual([[mine.id, 4]]);
  });

  it("leaves a later follow-up and a closed prospect out (R1)", () => {
    const tomorrow = brusselsMidnightDaysFromNow(NOW, 1) + 1;
    const joiners = join({
      prospects: [
        prospect({ status: "follow_up", nextVisitAt: tomorrow }),
        prospect({ status: "converted" }),
        prospect({ status: "follow_up", nextVisitAt: NOW }),
      ],
    });

    expect(joiners).toHaveLength(1);
  });

  it("sorts by name when no stop has a position to number from", () => {
    const [zed, abe] = [
      prospect({ name: "Zed", lat: null, lng: null }),
      prospect({ name: "Abe", lat: null, lng: null }),
    ];
    const joiners = join({
      stops: [{ prospectId: crypto.randomUUID(), number: 2 }],
      prospects: [zed, abe],
    });

    expect(joiners.map((j) => [j.number, j.prospectId])).toEqual([
      [3, abe.id],
      [4, zed.id],
    ]);
  });

  it("anchors on the highest-numbered stop that has coordinates", () => {
    const placed = prospect({ lat: 50.9, lng: 4.4 });
    const unplaced = prospect({ lat: null, lng: null });
    const [nearPlaced, nearOrigin] = [
      prospect({ name: "A", lat: 50.9, lng: 4.4001 }),
      prospect({ name: "B", lat: 50.0, lng: 4.0 }),
    ];
    const joiners = join({
      stops: [
        { prospectId: placed.id, number: 1 },
        { prospectId: unplaced.id, number: 2 },
        { prospectId: crypto.randomUUID(), number: 3 },
      ],
      prospects: [placed, unplaced, nearOrigin, nearPlaced],
    });

    expect(joiners.map((j) => j.prospectId)).toEqual([nearPlaced.id, nearOrigin.id]);
  });

  it("stops at TOURNEE_STOP_NUMBER_MAX", () => {
    const newcomers = [prospect(), prospect(), prospect()];
    const joiners = join({
      stops: [{ prospectId: crypto.randomUUID(), number: TOURNEE_STOP_NUMBER_MAX - 1 }],
      prospects: newcomers,
    });

    expect(joiners.map((j) => j.number)).toEqual([TOURNEE_STOP_NUMBER_MAX]);
  });

  it("gives nothing when nobody is new", () => {
    expect(join()).toEqual([]);
  });
});
