import { describe, expect, it } from "vitest";
import { brusselsPeriod } from "../../shared/period";
import type { Prospect, VisitedStop } from "../../shared/schemas";
import type {
  PulledStop,
  PulledTournee,
  StoredFieldProspect,
  StoredStop,
  StoredTournee,
  StoredVisit,
} from "./db";
import {
  carnetEntries,
  doorDaysToday,
  stopsOfToday,
  todaysStops,
  tourneeCounter,
  type TodaysStopsInput,
} from "./tournee-stops";

const ME = "a@example.com";
const NOW = 1_700_000_000_000;
const PERIOD = brusselsPeriod(NOW, 1);
const TODAY = PERIOD.from + 3_600_000;
const YESTERDAY = PERIOD.from - 3_600_000;

const prospect = (over: Partial<Prospect> = {}): Prospect => ({
  id: crypto.randomUUID(),
  name: "Le Bouchon",
  type: "restaurant",
  lat: 50.85,
  lng: 4.35,
  address: "Rue du Midi 42",
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
  createdAt: TODAY,
  writtenBy: ME,
  ...over,
});

const visit = (prospectId: string, over: Partial<StoredVisit> = {}): StoredVisit => ({
  id: crypto.randomUUID(),
  prospectId,
  visitedAt: TODAY,
  lat: null,
  lng: null,
  flyerGiven: false,
  outcome: "interested",
  followUpAt: null,
  notes: null,
  scriptId: null,
  answers: {},
  writtenBy: ME,
  ...over,
});

const visited = (prospectId: string, over: Partial<VisitedStop> = {}): VisitedStop => ({
  prospectId,
  outcome: "interested",
  visitedAt: TODAY,
  flyerGiven: false,
  visitIds: [crypto.randomUUID()],
  name: "x",
  type: "restaurant",
  address: null,
  ...over,
});

/** `noUncheckedIndexedAccess`: a missing fixture is a test bug, not a `undefined` to carry. */
const nth = <T>(items: readonly T[], i: number): T => {
  const item = items[i];
  if (item === undefined) throw new Error(`no fixture at ${i}`);
  return item;
};

const TOURNEE_ID = "00000000-0000-4000-8000-000000000001";
const pulledTournee = (over: Partial<PulledTournee> = {}): PulledTournee => ({
  id: TOURNEE_ID,
  dayStart: PERIOD.from,
  startedAt: TODAY,
  ...over,
});
const pulledStop = (
  prospectId: string,
  number: number,
  over: Partial<PulledStop> = {},
): PulledStop => ({
  id: crypto.randomUUID(),
  tourneeId: TOURNEE_ID,
  prospectId,
  number,
  addedAt: TODAY,
  left: false,
  ...over,
});

const QUEUED_ID = "00000000-0000-4000-8000-000000000002";
const queuedTournee = (over: Partial<StoredTournee> = {}): StoredTournee => ({
  id: QUEUED_ID,
  startedAt: TODAY,
  writtenBy: ME,
  ...over,
});
const queuedStop = (
  prospectId: string,
  number: number,
  over: Partial<StoredStop> = {},
): StoredStop => ({
  id: crypto.randomUUID(),
  tourneeId: QUEUED_ID,
  prospectId,
  number,
  addedAt: TODAY,
  writtenBy: ME,
  ...over,
});

const input = (over: Partial<TodaysStopsInput> = {}): TodaysStopsInput => ({
  pulledTournees: [],
  pulledStops: [],
  outboxTournees: [],
  outboxStops: [],
  prospects: [],
  outboxProspects: [],
  visitedStops: [],
  outboxVisits: [],
  identity: ME,
  now: NOW,
  point: null,
  ...over,
});

describe("todaysStops", () => {
  it("walked in order: stops 1-3 visited (server or outbox) leave 4, 5, 6 in number order", () => {
    const ps = Array.from({ length: 6 }, (_, i) => prospect({ name: `P${i + 1}` }));
    const stops = ps.map((p, i) => pulledStop(p.id, i + 1));

    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        // Stored out of order: the helper sorts, never the table.
        pulledStops: [...stops].reverse(),
        prospects: ps,
        visitedStops: [visited(nth(ps, 0).id)],
        outboxVisits: [visit(nth(ps, 1).id), visit(nth(ps, 2).id)],
      }),
    );

    expect(items.map((i) => [i.number, i.name])).toEqual([
      [4, "P4"],
      [5, "P5"],
      [6, "P6"],
    ]);
  });

  it("any outcome leaves: À relancer today or later, Personne sur place, Converti", () => {
    const ps = [prospect(), prospect(), prospect(), prospect()];
    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: ps.map((p, i) => pulledStop(p.id, i + 1)),
        prospects: ps,
        outboxVisits: [
          visit(nth(ps, 0).id, { outcome: "follow_up", followUpAt: TODAY }),
          visit(nth(ps, 1).id, { outcome: "follow_up", followUpAt: PERIOD.to + 86_400_000 }),
          visit(nth(ps, 2).id, { outcome: "no_contact", followUpAt: PERIOD.to + 86_400_000 }),
        ],
      }),
    );

    expect(items.map((i) => i.id)).toEqual([nth(ps, 3).id]);
  });

  it("an outbox visit written by another identity leaves the stop where it is", () => {
    const p = prospect();
    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(p.id, 1)],
        prospects: [p],
        outboxVisits: [visit(p.id, { writtenBy: "b@example.com" })],
      }),
    );

    expect(items).toHaveLength(1);
  });

  it("an unstamped outbox visit is this identity's", () => {
    const p = prospect();
    const bare: StoredVisit = { ...visit(p.id), writtenBy: undefined };
    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(p.id, 1)],
        prospects: [p],
        outboxVisits: [bare],
      }),
    );

    expect(items).toEqual([]);
  });

  it("yesterday's visits, pulled or queued, do not hide today's stop", () => {
    const p = prospect();
    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(p.id, 1)],
        prospects: [p],
        visitedStops: [visited(p.id, { visitedAt: YESTERDAY })],
        outboxVisits: [visit(p.id, { visitedAt: YESTERDAY })],
      }),
    );

    expect(items).toHaveLength(1);
  });

  it("a queued tournée not pulled yet gives its outbox stops, numbered", () => {
    const [a, b] = [prospect({ name: "A" }), prospect({ name: "B" })];
    const items = todaysStops(
      input({
        outboxTournees: [queuedTournee()],
        outboxStops: [queuedStop(b.id, 2), queuedStop(a.id, 1)],
        prospects: [a, b],
      }),
    );

    expect(items.map((i) => [i.number, i.name])).toEqual([
      [1, "A"],
      [2, "B"],
    ]);
  });

  it("another identity's queued tournée is not this agent's day", () => {
    const p = prospect();
    const items = todaysStops(
      input({
        outboxTournees: [queuedTournee({ writtenBy: "b@example.com" })],
        outboxStops: [queuedStop(p.id, 1, { writtenBy: "b@example.com" })],
        prospects: [p],
      }),
    );

    expect(items).toEqual([]);
  });

  it("a queued tournée from yesterday is not today's", () => {
    const p = prospect();
    const items = todaysStops(
      input({
        outboxTournees: [queuedTournee({ startedAt: YESTERDAY })],
        outboxStops: [queuedStop(p.id, 1)],
        prospects: [p],
      }),
    );

    expect(items).toEqual([]);
  });

  it("with both a pulled and a queued tournée, the pulled one's stops win", () => {
    const [a, b] = [prospect({ name: "pulled" }), prospect({ name: "queued" })];
    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(a.id, 3)],
        outboxTournees: [queuedTournee()],
        outboxStops: [queuedStop(b.id, 1)],
        prospects: [a, b],
      }),
    );

    expect(items.map((i) => [i.number, i.name])).toEqual([[3, "pulled"]]);
  });

  it("another identity's outbox field prospect gives no row", () => {
    const f = fieldProspect({ writtenBy: "b@example.com" });
    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(f.id, 1)],
        outboxProspects: [f],
      }),
    );

    expect(items).toEqual([]);
  });

  it("a queued tournée's stop stamped by another identity is not listed", () => {
    const [a, b] = [prospect({ name: "A" }), prospect({ name: "B" })];
    const items = todaysStops(
      input({
        outboxTournees: [queuedTournee()],
        outboxStops: [queuedStop(a.id, 1), queuedStop(b.id, 2, { writtenBy: "b@example.com" })],
        prospects: [a, b],
      }),
    );

    expect(items.map((i) => i.name)).toEqual(["A"]);
  });

  it("a stop whose prospect is only in the outbox is a pending row", () => {
    const f = fieldProspect({ lat: 50.9, lng: 4.4, address: "Quai 1" });
    const [item] = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(f.id, 5)],
        outboxProspects: [f],
      }),
    );

    expect(item).toMatchObject({
      id: f.id,
      number: 5,
      pending: true,
      status: null,
      type: "food_truck",
      lat: 50.9,
      lng: 4.4,
      address: "Quai 1",
    });
  });

  it("a prospect both held and queued counts as the server's, not pending", () => {
    const p = prospect();
    const [item] = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(p.id, 1)],
        prospects: [p],
        outboxProspects: [fieldProspect({ id: p.id })],
      }),
    );

    expect(item?.pending).toBe(false);
    expect(item?.status).toBe("assigned");
  });

  it("a stop whose prospect is held nowhere draws no row and leaves its number missing", () => {
    const [a, c] = [prospect(), prospect()];
    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(a.id, 1), pulledStop(crypto.randomUUID(), 2), pulledStop(c.id, 3)],
        prospects: [a, c],
      }),
    );

    expect(items.map((i) => i.number)).toEqual([1, 3]);
  });

  it("a stop without coordinates keeps its row and number", () => {
    const p = prospect({ lat: null, lng: null });
    const [item] = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(p.id, 2)],
        prospects: [p],
        point: { lat: 50.85, lng: 4.35 },
      }),
    );

    expect(item).toMatchObject({ number: 2, lat: null, lng: null, distanceM: null });
  });

  it("a reading adds distances and never reorders; none leaves the same order", () => {
    const [near, far] = [prospect({ lat: 50.8501, lng: 4.35 }), prospect({ lat: 50.95, lng: 4.5 })];
    const base = input({
      pulledTournees: [pulledTournee()],
      // The far stop is number 1: the nearest-first rule must not apply.
      pulledStops: [pulledStop(far.id, 1), pulledStop(near.id, 2)],
      prospects: [near, far],
    });

    const withPoint = todaysStops({ ...base, point: { lat: 50.85, lng: 4.35 } });
    const without = todaysStops(base);

    expect(withPoint.map((i) => i.number)).toEqual([1, 2]);
    expect(without.map((i) => i.number)).toEqual([1, 2]);
    expect(withPoint[0]?.distanceM).toBeGreaterThan(withPoint[1]?.distanceM ?? Infinity);
    expect(without.every((i) => i.distanceM === null)).toBe(true);
  });

  it("every stop visited leaves nothing", () => {
    const ps = [prospect(), prospect()];
    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: ps.map((p, i) => pulledStop(p.id, i + 1)),
        prospects: ps,
        outboxVisits: ps.map((p) => visit(p.id)),
      }),
    );

    expect(items).toEqual([]);
  });

  it("no tournée today gives no stops", () => {
    const p = prospect();
    expect(
      todaysStops(
        input({
          pulledTournees: [pulledTournee({ dayStart: PERIOD.from - 86_400_000 })],
          pulledStops: [pulledStop(p.id, 1)],
          prospects: [p],
        }),
      ),
    ).toEqual([]);
  });
});

describe("doorDaysToday", () => {
  it("unions the server's visited stops with this identity's outbox, today only", () => {
    const [a, b, c, d] = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
    const days = doorDaysToday({
      visitedStops: [visited(a), visited(d, { visitedAt: YESTERDAY })],
      outboxVisits: [visit(b), visit(c, { writtenBy: "b@example.com" })],
      identity: ME,
      period: PERIOD,
    });

    expect([...days.keys()].sort()).toEqual([a, b].sort());
  });

  it("joins by visit id: the same visit on both sides is one visit and not pending", () => {
    const p = crypto.randomUUID();
    const queued = visit(p);
    const days = doorDaysToday({
      visitedStops: [visited(p, { visitIds: [queued.id] })],
      outboxVisits: [queued],
      identity: ME,
      period: PERIOD,
    });

    expect(days.get(p)).toMatchObject({ visitIds: [queued.id], pending: false });
  });

  it("a later outbox visit joins the day, is pending and gives the outcome", () => {
    const p = crypto.randomUUID();
    const server = visited(p, { outcome: "no_contact", visitedAt: TODAY });
    const later = visit(p, { outcome: "converted", visitedAt: TODAY + 1000 });
    const days = doorDaysToday({
      visitedStops: [server],
      outboxVisits: [later],
      identity: ME,
      period: PERIOD,
    });

    expect(days.get(p)).toMatchObject({
      visitIds: [...server.visitIds, later.id],
      outcome: "converted",
      visitedAt: TODAY + 1000,
      pending: true,
    });
  });

  it("an unconfirmed or unstamped outbox visit is mine", () => {
    const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
    const days = doorDaysToday({
      visitedStops: [],
      outboxVisits: [visit(a, { unconfirmed: true }), visit(b, { writtenBy: undefined })],
      identity: ME,
      period: PERIOD,
    });

    expect(days.size).toBe(2);
  });
});

describe("tourneeCounter", () => {
  const twenty = () => Array.from({ length: 20 }, () => prospect());
  const tournee = (
    ps: readonly Prospect[],
    over: (i: number) => Partial<PulledStop> = () => ({}),
  ) => ({
    pulledTournees: [pulledTournee()],
    pulledStops: ps.map((p, i) => pulledStop(p.id, i + 1, over(i))),
    outboxTournees: [],
    outboxStops: [],
    visitedStops: [],
    outboxVisits: [],
    identity: ME,
    now: NOW,
  });

  it("15 of 20, from the server and the outbox together", () => {
    const ps = twenty();
    const base = tournee(ps);

    expect(
      tourneeCounter({
        ...base,
        visitedStops: ps.slice(0, 10).map((p) => visited(p.id)),
        outboxVisits: ps.slice(10, 15).map((p) => visit(p.id)),
      }),
    ).toEqual({ n: 15, total: 20, percent: 75 });
  });

  it("right after the swipe is 0 of 20", () => {
    expect(tourneeCounter(tournee(twenty()))).toEqual({ n: 0, total: 20, percent: 0 });
  });

  it("a second visit to a visited stop does not move n", () => {
    const ps = twenty();
    const base = tournee(ps);
    const first = visited(nth(ps, 2).id);

    expect(
      tourneeCounter({
        ...base,
        visitedStops: [first],
        outboxVisits: [visit(nth(ps, 2).id)],
      }),
    ).toEqual({ n: 1, total: 20, percent: 5 });
  });

  it("the same visit on both sides counts once", () => {
    const ps = twenty();
    const queued = visit(nth(ps, 0).id);

    expect(
      tourneeCounter({
        ...tournee(ps),
        visitedStops: [visited(queued.prospectId, { visitIds: [queued.id] })],
        outboxVisits: [queued],
      }),
    ).toEqual({ n: 1, total: 20, percent: 5 });
  });

  it("an unsynced visit counts before any sync", () => {
    const ps = twenty();

    expect(tourneeCounter({ ...tournee(ps), outboxVisits: [visit(nth(ps, 5).id)] })).toEqual({
      n: 1,
      total: 20,
      percent: 5,
    });
  });

  it("another identity's outbox visit does not count", () => {
    const ps = twenty();

    expect(
      tourneeCounter({
        ...tournee(ps),
        outboxVisits: [visit(nth(ps, 5).id, { writtenBy: "b@example.com" })],
      }),
    ).toEqual({ n: 0, total: 20, percent: 0 });
  });

  it("yesterday's visits do not count", () => {
    const ps = twenty();

    expect(
      tourneeCounter({
        ...tournee(ps),
        visitedStops: [visited(nth(ps, 0).id, { visitedAt: YESTERDAY })],
        outboxVisits: [visit(nth(ps, 1).id, { visitedAt: YESTERDAY })],
      }),
    ).toEqual({ n: 0, total: 20, percent: 0 });
  });

  it("a door-day with no stop counts in neither n nor total", () => {
    const ps = twenty();

    expect(
      tourneeCounter({
        ...tournee(ps),
        visitedStops: [visited(crypto.randomUUID())],
        outboxVisits: [visit(crypto.randomUUID())],
      }),
    ).toEqual({ n: 0, total: 20, percent: 0 });
  });

  it("a stop reassigned unvisited leaves total and not n", () => {
    const ps = twenty();

    expect(tourneeCounter(tournee(ps, (i) => ({ left: i === 19 })))).toEqual({
      n: 0,
      total: 19,
      percent: 0,
    });
  });

  it("a stop pulled left with a visit still in the outbox stays in n and total", () => {
    const ps = twenty();

    expect(
      tourneeCounter({
        ...tournee(ps, (i) => ({ left: i === 0 })),
        outboxVisits: [visit(nth(ps, 0).id)],
      }),
    ).toEqual({ n: 1, total: 20, percent: 5 });
  });

  it("a joiner adds one to total", () => {
    const ps = twenty();
    const joiner = prospect();

    expect(
      tourneeCounter({
        ...tournee(ps),
        pulledStops: [
          ...tournee(ps).pulledStops,
          pulledStop(joiner.id, 21, { addedAt: TODAY + 1 }),
        ],
      }),
    ).toEqual({ n: 0, total: 21, percent: 0 });
  });

  it("after a cache wipe, a pull of 15 visited stops reads 15 of 20 again", () => {
    const ps = twenty();
    const wiped = tournee(ps);
    expect(tourneeCounter(wiped)).toEqual({ n: 0, total: 20, percent: 0 });

    expect(
      tourneeCounter({ ...wiped, visitedStops: ps.slice(0, 15).map((p) => visited(p.id)) }),
    ).toEqual({ n: 15, total: 20, percent: 75 });
  });

  it("rounds percent: 2 of 3 visited is 67", () => {
    const ps = twenty().slice(0, 3);

    expect(
      tourneeCounter({ ...tournee(ps), visitedStops: ps.slice(0, 2).map((p) => visited(p.id)) }),
    ).toEqual({ n: 2, total: 3, percent: 67 });
  });

  it("no stops, or all left unvisited, has a total of 0", () => {
    expect(tourneeCounter(tournee([]))).toEqual({ n: 0, total: 0, percent: 0 });
    const ps = twenty().slice(0, 2);
    expect(tourneeCounter(tournee(ps, () => ({ left: true })))).toEqual({
      n: 0,
      total: 0,
      percent: 0,
    });
  });

  it("no tournée today is 0 of 0", () => {
    expect(
      tourneeCounter({
        ...tournee([]),
        pulledTournees: [],
        outboxTournees: [queuedTournee({ startedAt: YESTERDAY })],
      }),
    ).toEqual({ n: 0, total: 0, percent: 0 });
  });
});

describe("leavers, joiners and the total", () => {
  const seven = () => Array.from({ length: 7 }, (_, i) => prospect({ name: `P${i + 4}` }));

  it("drops a stop the server marks left, and the next stop does not change", () => {
    const ps = seven();
    const stops = ps.map((p, i) => pulledStop(p.id, i + 4, { left: i === 3 }));
    const base = input({
      pulledTournees: [pulledTournee()],
      pulledStops: stops,
      prospects: ps,
    });

    const items = todaysStops(base);

    expect(items.map((i) => i.number)).toEqual([4, 5, 6, 8, 9, 10]);
    expect(nth(items, 0).number).toBe(4);
    expect(tourneeCounter({ ...base, visitedStops: [], outboxVisits: [] }).total).toBe(6);
  });

  it("a stop that comes back keeps its number and is not a joiner", () => {
    const p = prospect();
    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(p.id, 7, { left: false })],
        prospects: [p],
      }),
    );

    expect(items.map((i) => [i.number, i.joiner])).toEqual([[7, false]]);
  });

  it("marks a stop added after the swipe as a joiner, and no other", () => {
    const [a, b] = [prospect(), prospect()];
    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(a.id, 1), pulledStop(b.id, 2, { addedAt: TODAY + 1 })],
        prospects: [a, b],
      }),
    );

    expect(items.map((i) => [i.number, i.joiner])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("shows a joiner still in the outbox next to the pulled stops, once", () => {
    const [a, b] = [prospect(), prospect()];
    const items = todaysStops(
      input({
        pulledTournees: [pulledTournee()],
        pulledStops: [pulledStop(a.id, 1)],
        // The pull holds `a` already, so its queued twin is not drawn again.
        outboxStops: [
          queuedStop(a.id, 1, { tourneeId: TOURNEE_ID }),
          queuedStop(b.id, 2, { tourneeId: TOURNEE_ID, addedAt: TODAY + 1 }),
          queuedStop(prospect().id, 3, { tourneeId: TOURNEE_ID, writtenBy: "b@example.com" }),
        ],
        prospects: [a, b],
      }),
    );

    expect(items.map((i) => [i.number, i.joiner])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("flags a joiner on a tournée still only in the outbox", () => {
    const [a, b] = [prospect(), prospect()];
    const items = todaysStops(
      input({
        outboxTournees: [queuedTournee()],
        outboxStops: [queuedStop(a.id, 1), queuedStop(b.id, 2, { addedAt: TODAY + 1 })],
        prospects: [a, b],
      }),
    );

    expect(items.map((i) => [i.number, i.joiner])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("counts each prospect once, visited stops in and left stops out", () => {
    const ps = [prospect(), prospect(), prospect()];
    const { total } = tourneeCounter({
      visitedStops: [],
      outboxVisits: [],
      pulledTournees: [pulledTournee()],
      pulledStops: [
        pulledStop(nth(ps, 0).id, 1),
        pulledStop(nth(ps, 1).id, 2, { left: true }),
        pulledStop(nth(ps, 2).id, 3),
      ],
      outboxTournees: [],
      outboxStops: [queuedStop(nth(ps, 0).id, 4, { tourneeId: TOURNEE_ID })],
      identity: ME,
      now: NOW,
    });

    expect(total).toBe(2);
  });

  it("a total with no tournée today is 0", () => {
    expect(
      tourneeCounter({
        visitedStops: [],
        outboxVisits: [],
        pulledTournees: [],
        pulledStops: [],
        outboxTournees: [queuedTournee({ startedAt: YESTERDAY })],
        outboxStops: [],
        identity: ME,
        now: NOW,
      }).total,
    ).toBe(0);
  });

  it("reads the queued tournée's stops, and nobody else's", () => {
    const p = prospect();
    const day = stopsOfToday(
      {
        pulledTournees: [],
        pulledStops: [],
        outboxTournees: [
          queuedTournee(),
          queuedTournee({ id: crypto.randomUUID(), writtenBy: "b@example.com" }),
        ],
        outboxStops: [queuedStop(p.id, 1)],
        identity: ME,
      },
      PERIOD,
    );

    expect(day?.tourneeId).toBe(QUEUED_ID);
    expect(day?.stops.map((s) => s.number)).toEqual([1]);
  });
});

describe("carnetEntries", () => {
  const LATER = TODAY + 3_600_000;
  const swiped = (ps: Prospect[], over: Partial<Parameters<typeof carnetEntries>[0]> = {}) => ({
    pulledTournees: [pulledTournee()],
    pulledStops: ps.map((p, i) => pulledStop(p.id, i + 1)),
    outboxTournees: [],
    outboxStops: [],
    prospects: ps,
    outboxProspects: [],
    visitedStops: [],
    outboxVisits: [],
    identity: ME,
    now: NOW,
    ...over,
  });
  const three = () => [0, 1, 2].map((i) => prospect({ name: `P${i + 1}` }));

  it("lists converted then no contact, newest first, with their numbers", () => {
    const ps = [...three(), prospect({ name: "P4" })];
    const entries = carnetEntries(
      swiped(ps, {
        visitedStops: [
          visited(nth(ps, 3).id, { outcome: "converted", visitedAt: TODAY, name: "P4" }),
          visited(nth(ps, 1).id, { outcome: "no_contact", visitedAt: LATER, name: "P2" }),
        ],
      }),
    );
    expect(entries.map((e) => [e.number, e.outcome, e.pending, e.visitCount])).toEqual([
      [2, "no_contact", false, 1],
      [4, "converted", false, 1],
    ]);
  });

  it("a reopened door-day moves to the top, pending, with two visits", () => {
    const ps = three();
    const first = visited(nth(ps, 0).id, { outcome: "converted", visitedAt: TODAY });
    const other = visited(nth(ps, 1).id, { outcome: "interested", visitedAt: TODAY + 1000 });
    const entries = carnetEntries(
      swiped(ps, {
        visitedStops: [first, other],
        outboxVisits: [visit(nth(ps, 0).id, { outcome: "follow_up", visitedAt: LATER })],
      }),
    );
    expect(entries[0]).toMatchObject({
      number: 1,
      outcome: "follow_up",
      pending: true,
      visitCount: 2,
    });
  });

  it("an outbox-only visit shows, pending", () => {
    const ps = three();
    const entries = carnetEntries(swiped(ps, { outboxVisits: [visit(nth(ps, 2).id)] }));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ number: 3, pending: true, visitCount: 1 });
  });

  it("the same visit on both sides is one visit and not pending", () => {
    const ps = three();
    const queued = visit(nth(ps, 0).id);
    const entries = carnetEntries(
      swiped(ps, {
        visitedStops: [visited(queued.prospectId, { visitIds: [queued.id] })],
        outboxVisits: [queued],
      }),
    );
    expect(entries[0]).toMatchObject({ pending: false, visitCount: 1 });
  });

  it("a door-day the server lists with three visits counts three and is not pending", () => {
    const ps = three();
    const entries = carnetEntries(
      swiped(ps, {
        visitedStops: [
          visited(nth(ps, 0).id, {
            visitIds: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
          }),
        ],
      }),
    );
    expect(entries[0]).toMatchObject({ visitCount: 3, pending: false });
  });

  it("a prospect with no stop today has a null number", () => {
    const ps = three();
    const stranger = prospect({ name: "Hors tournée" });
    const entries = carnetEntries(
      swiped(ps, {
        prospects: [...ps, stranger],
        outboxVisits: [visit(stranger.id)],
      }),
    );
    expect(entries[0]).toMatchObject({ number: null, name: "Hors tournée" });
  });

  it("a stop marked left keeps its number once visited", () => {
    const ps = three();
    const entries = carnetEntries(
      swiped(ps, {
        pulledStops: ps.map((p, i) => pulledStop(p.id, i + 1, { left: i === 1 })),
        outboxVisits: [visit(nth(ps, 1).id)],
      }),
    );
    expect(entries[0]?.number).toBe(2);
  });

  it("a closed prospect gone from prospects is named by its visited stop", () => {
    const ps = three();
    const gone = visited(nth(ps, 0).id, { outcome: "converted", name: "Chez Marie", type: "bar" });
    const entries = carnetEntries(swiped(ps, { prospects: [], visitedStops: [gone] }));
    expect(entries[0]).toMatchObject({ name: "Chez Marie", type: "bar", number: 1 });
  });

  it("names an outbox-only field prospect from outboxProspects", () => {
    const field = fieldProspect({ name: "Camion neuf" });
    const entries = carnetEntries(
      swiped([], {
        pulledTournees: [],
        outboxProspects: [field],
        outboxVisits: [visit(field.id)],
      }),
    );
    expect(entries[0]).toMatchObject({ name: "Camion neuf", number: null });
  });

  it("does not draw a door-day nothing can name", () => {
    const ps = three();
    expect(carnetEntries(swiped(ps, { outboxVisits: [visit(crypto.randomUUID())] }))).toEqual([]);
  });

  it("skips another identity's outbox visit and yesterday's", () => {
    const ps = three();
    const entries = carnetEntries(
      swiped(ps, {
        outboxVisits: [
          visit(nth(ps, 0).id, { writtenBy: "b@example.com" }),
          visit(nth(ps, 1).id, { visitedAt: YESTERDAY }),
        ],
        visitedStops: [visited(nth(ps, 2).id, { visitedAt: YESTERDAY })],
      }),
    );
    expect(entries).toEqual([]);
  });

  it("is empty with no door-day today, and rebuilt from a pull after a cache wipe", () => {
    const ps = three();
    expect(carnetEntries(swiped(ps))).toEqual([]);
    const pulled = ps.map((p) => visited(p.id, { name: p.name }));
    expect(carnetEntries(swiped([], { pulledTournees: [], visitedStops: pulled }))).toHaveLength(3);
  });
});
