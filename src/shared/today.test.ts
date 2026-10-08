import { describe, expect, it } from "vitest";
import type { FieldProspect, Prospect } from "./schemas";
import { brusselsPeriod } from "./period";
import { buildTodayList, type QueuedVisit } from "./today";

/** The Grand-Place, which is where the local seed puts the round. */
const GRAND_PLACE = { lat: 50.8467, lng: 4.3525 };
const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

const prospect = (over: Partial<Prospect> = {}): Prospect => ({
  id: crypto.randomUUID(),
  name: "Le Bouchon",
  type: "restaurant",
  lat: null,
  lng: null,
  address: null,
  phone: null,
  website: null,
  cuisine: null,
  source: "csv",
  status: "assigned",
  assignedTo: "agent@example.com",
  lastVisitAt: null,
  nextVisitAt: null,
  ...over,
});

const queuedVisit = (over: Partial<QueuedVisit> = {}): QueuedVisit => ({
  prospectId: crypto.randomUUID(),
  outcome: "follow_up",
  followUpAt: null,
  visitedAt: NOW,
  ...over,
});

const field = (over: Partial<FieldProspect> = {}): FieldProspect => ({
  id: crypto.randomUUID(),
  name: "Food truck du pont",
  type: "food_truck",
  lat: null,
  lng: null,
  address: null,
  phone: null,
  createdAt: NOW,
  ...over,
});

/** Roughly 100 m, 400 m and 800 m north of the Grand-Place. */
const near = (metresNorth: number) => ({
  lat: GRAND_PLACE.lat + metresNorth / 111_320,
  lng: GRAND_PLACE.lng,
});

describe("buildTodayList", () => {
  it("orders the round nearest-next from the agent", () => {
    const list = buildTodayList(
      [
        prospect({ name: "loin", ...near(800) }),
        prospect({ name: "près", ...near(100) }),
        prospect({ name: "milieu", ...near(400) }),
      ],
      [],
      GRAND_PLACE,
      NOW,
    );

    expect(list.now.map((i) => i.name)).toEqual(["près", "milieu", "loin"]);
  });

  it("puts prospects with no coordinates last, keeping their order", () => {
    const list = buildTodayList(
      [
        prospect({ name: "sans position" }),
        prospect({ name: "avec position", ...near(500) }),
        prospect({ name: "sans position aussi" }),
      ],
      [],
      GRAND_PLACE,
      NOW,
    );

    expect(list.now.map((i) => i.name)).toEqual([
      "avec position",
      "sans position",
      "sans position aussi",
    ]);
  });

  it("leaves the order alone when there is no position to measure from", () => {
    // A denied permission must not reorder or hide anything.
    const list = buildTodayList(
      [prospect({ name: "a", ...near(900) }), prospect({ name: "b", ...near(50) })],
      [],
      null,
      NOW,
    );

    expect(list.now.map((i) => i.name)).toEqual(["a", "b"]);
    expect(list.now.every((i) => i.distanceM === null)).toBe(true);
  });

  it("measures the distance to each located prospect", () => {
    const [item] = buildTodayList([prospect(near(1000))], [], GRAND_PLACE, NOW).now;

    expect(item?.distanceM).toBeGreaterThan(950);
    expect(item?.distanceM).toBeLessThan(1050);
  });

  describe("the later group", () => {
    it("holds back a follow-up that is not due yet", () => {
      const list = buildTodayList(
        [
          prospect({ name: "à faire", status: "assigned" }),
          prospect({
            name: "la semaine prochaine",
            status: "follow_up",
            nextVisitAt: NOW + 7 * DAY,
          }),
        ],
        [],
        GRAND_PLACE,
        NOW,
      );

      expect(list.now.map((i) => i.name)).toEqual(["à faire"]);
      expect(list.later.map((i) => i.name)).toEqual(["la semaine prochaine"]);
    });

    it("keeps an overdue follow-up in the round", () => {
      const list = buildTodayList(
        [prospect({ name: "en retard", status: "follow_up", nextVisitAt: NOW - DAY })],
        [],
        GRAND_PLACE,
        NOW,
      );

      expect(list.now.map((i) => i.name)).toEqual(["en retard"]);
      expect(list.later).toEqual([]);
    });

    it("keeps a follow-up with no date in the round", () => {
      const list = buildTodayList(
        [prospect({ name: "sans date", status: "follow_up", nextVisitAt: null })],
        [],
        GRAND_PLACE,
        NOW,
      );

      expect(list.now.map((i) => i.name)).toEqual(["sans date"]);
    });

    it("sorts the later group by when it comes due, not by distance", () => {
      const list = buildTodayList(
        [
          prospect({
            name: "dans 7 j",
            status: "follow_up",
            nextVisitAt: NOW + 7 * DAY,
            ...near(10),
          }),
          prospect({
            name: "dans 2 j",
            status: "follow_up",
            nextVisitAt: NOW + 2 * DAY,
            ...near(900),
          }),
        ],
        [],
        GRAND_PLACE,
        NOW,
      );

      expect(list.later.map((i) => i.name)).toEqual(["dans 2 j", "dans 7 j"]);
    });
  });

  describe("unsynced field prospects", () => {
    it("shows one the server has not accepted yet, so it can be visited offline", () => {
      const list = buildTodayList([], [field({ name: "Food truck du pont" })], GRAND_PLACE, NOW);

      expect(list.now.map((i) => i.name)).toEqual(["Food truck du pont"]);
      expect(list.now[0]?.pending).toBe(true);
    });

    it("invents no status for a prospect the server has never seen", () => {
      // INVARIANT 3: status is the server's to derive.
      const list = buildTodayList([], [field()], GRAND_PLACE, NOW);

      expect(list.now[0]?.status).toBeNull();
    });

    it("orders it among the rest by distance like anything else", () => {
      const list = buildTodayList(
        [prospect({ name: "loin", ...near(800) }), prospect({ name: "près", ...near(100) })],
        [field({ name: "camion", ...near(400) })],
        GRAND_PLACE,
        NOW,
      );

      expect(list.now.map((i) => i.name)).toEqual(["près", "camion", "loin"]);
    });

    it("does not show it twice in the window between accept and outbox delete", () => {
      const id = crypto.randomUUID();
      const list = buildTodayList(
        [prospect({ id, name: "Food truck du pont", source: "field" })],
        [field({ id, name: "Food truck du pont" })],
        GRAND_PLACE,
        NOW,
      );

      expect(list.now).toHaveLength(1);
      // The server's copy wins: it is the one with a real status.
      expect(list.now[0]?.pending).toBe(false);
    });
  });
});

describe("visitQueued", () => {
  it("defaults to false, so calls that predate the parameter keep working", () => {
    const list = buildTodayList([prospect({ name: "a" })], [], GRAND_PLACE, NOW);

    expect(list.now[0]?.visitQueued).toBe(false);
  });

  it("flags a field prospect not yet accepted, on top of its own pending flag", () => {
    const outboxRow = field({ name: "camion" });
    const list = buildTodayList([], [outboxRow], GRAND_PLACE, NOW, [
      queuedVisit({ prospectId: outboxRow.id, outcome: "no_contact" }),
    ]);

    expect(list.now[0]?.pending).toBe(true);
    expect(list.now[0]?.visitQueued).toBe(true);
  });
});

/**
 * Where a saved stop sits before and after the sync — round-placement.md's
 * I/O matrix (GH #239, epic #117 retro).
 */
describe("round placement", () => {
  it("a queued closed result leaves the round: absent from now and later", () => {
    const closed = prospect({ name: "Curry House" });
    const list = buildTodayList(
      [closed, prospect({ name: "Bar des Marolles" })],
      [],
      GRAND_PLACE,
      NOW,
      [queuedVisit({ prospectId: closed.id, outcome: "interested" })],
    );

    expect(list.now.map((i) => i.name)).toEqual(["Bar des Marolles"]);
    expect(list.later).toEqual([]);
  });

  it.each(["interested", "converted", "not_interested"] as const)(
    "every closed outcome (%s) leaves the round the same way",
    (outcome) => {
      const closed = prospect({ name: "Curry House" });
      const list = buildTodayList([closed], [], GRAND_PLACE, NOW, [
        queuedVisit({ prospectId: closed.id, outcome }),
      ]);

      expect(list.now).toEqual([]);
      expect(list.later).toEqual([]);
    },
  );

  it("a queued follow-up date after today sits under Plus tard, sorted by that date", () => {
    const dated = prospect({ name: "Repasser jeudi" });
    const list = buildTodayList([dated], [], GRAND_PLACE, NOW, [
      queuedVisit({ prospectId: dated.id, outcome: "follow_up", followUpAt: NOW + 3 * DAY }),
    ]);

    expect(list.now).toEqual([]);
    expect(list.later.map((i) => i.name)).toEqual(["Repasser jeudi"]);
    expect(list.later[0]?.visitQueued).toBe(true);
    expect(list.later[0]?.nextVisitAt).toBe(NOW + 3 * DAY);
  });

  it("sorts a queued date among pulled follow-ups by that date", () => {
    const dated = prospect({ name: "queued, day 3" });
    const pulled = prospect({
      name: "pulled, day 2",
      status: "follow_up",
      nextVisitAt: NOW + 2 * DAY,
    });
    const list = buildTodayList([dated, pulled], [], GRAND_PLACE, NOW, [
      queuedVisit({ prospectId: dated.id, followUpAt: NOW + 3 * DAY }),
    ]);

    expect(list.later.map((i) => i.name)).toEqual(["pulled, day 2", "queued, day 3"]);
  });

  it("places a stop by its latest queued visit, whichever order they were queued in", () => {
    const { from: todayStart } = brusselsPeriod(NOW, 1);
    const closedLast = prospect({ name: "closed last" });
    const keptLast = prospect({ name: "kept last" });
    const list = buildTodayList([closedLast, keptLast], [], GRAND_PLACE, NOW, [
      queuedVisit({ prospectId: closedLast.id, outcome: "interested", visitedAt: NOW }),
      queuedVisit({
        prospectId: closedLast.id,
        outcome: "no_contact",
        followUpAt: todayStart,
        visitedAt: NOW - 1000,
      }),
      queuedVisit({
        prospectId: keptLast.id,
        outcome: "no_contact",
        followUpAt: todayStart,
        visitedAt: NOW,
      }),
      queuedVisit({ prospectId: keptLast.id, outcome: "interested", visitedAt: NOW - 1000 }),
    ]);

    expect(list.now.map((i) => i.name)).toEqual(["kept last"]);
    expect(list.later).toEqual([]);
  });

  it("a when-step visit queued yesterday and still unsent joins the normal order", () => {
    const { from: todayStart } = brusselsPeriod(NOW, 1);
    const overnight = prospect({ name: "hier", ...near(50) });
    const list = buildTodayList(
      [prospect({ name: "loin", ...near(800) }), overnight],
      [],
      GRAND_PLACE,
      NOW,
      [
        queuedVisit({
          prospectId: overnight.id,
          outcome: "no_contact",
          followUpAt: todayStart - DAY,
          visitedAt: todayStart - 1000,
        }),
      ],
    );

    expect(list.now.map((i) => i.name)).toEqual(["hier", "loin"]);
    expect(list.now[0]?.visitQueued).toBe(true);
  });

  it("a queued Aujourd'hui sits last in now, keeping « Pas encore envoyé »", () => {
    const { to: tomorrow } = brusselsPeriod(NOW, 1);
    const today = tomorrow - DAY;
    const near0 = prospect({ name: "près", ...near(100) });
    const queuedToday = prospect({ name: "Aujourd'hui", ...near(50) });
    const list = buildTodayList([near0, queuedToday], [], GRAND_PLACE, NOW, [
      queuedVisit({ prospectId: queuedToday.id, outcome: "no_contact", followUpAt: today }),
    ]);

    expect(list.now.map((i) => i.name)).toEqual(["près", "Aujourd'hui"]);
    expect(list.now[1]?.visitQueued).toBe(true);
    expect(list.later).toEqual([]);
  });

  it("a stop pulled kept for today (lastVisitAt today, nextVisitAt today) sits last in now", () => {
    const { from: todayStart } = brusselsPeriod(NOW, 1);
    const near0 = prospect({ name: "près", ...near(100) });
    const kept = prospect({
      name: "gardé pour aujourd'hui",
      status: "follow_up",
      lastVisitAt: todayStart,
      nextVisitAt: todayStart,
      ...near(900),
    });
    const list = buildTodayList([near0, kept], [], GRAND_PLACE, NOW);

    // "End of today's round" ignores distance: "gardé" is much closer than
    // "près" would normally put it, and still sorts last.
    expect(list.now.map((i) => i.name)).toEqual(["près", "gardé pour aujourd'hui"]);
    expect(list.later).toEqual([]);
  });

  it("a stop pulled kept for today with no nextVisitAt sits last in now the same way", () => {
    const { from: todayStart } = brusselsPeriod(NOW, 1);
    const kept = prospect({
      name: "gardé",
      status: "follow_up",
      lastVisitAt: todayStart,
      nextVisitAt: null,
    });
    const list = buildTodayList([kept], [], GRAND_PLACE, NOW);

    expect(list.now.map((i) => i.name)).toEqual(["gardé"]);
  });

  it("a stop visited yesterday keeps the normal nearest-next order, not forced last", () => {
    const { from: todayStart } = brusselsPeriod(NOW, 1);
    const yesterday = prospect({
      name: "hier",
      status: "follow_up",
      lastVisitAt: todayStart - 1,
      nextVisitAt: null,
      ...near(900),
    });
    const near0 = prospect({ name: "près", ...near(100) });
    const list = buildTodayList([yesterday, near0], [], GRAND_PLACE, NOW);

    expect(list.now.map((i) => i.name)).toEqual(["près", "hier"]);
  });
});

describe("the admin round view's call", () => {
  // The admin has no outbox and no queued visits, only the position the
  // phone sent at sync (ADR-0028) — or none.
  const { from: todayStart } = brusselsPeriod(NOW, 1);
  const stops = () => [
    prospect({ name: "loin", ...near(800) }),
    prospect({
      name: "gardé pour aujourd'hui",
      status: "follow_up",
      lastVisitAt: todayStart,
      nextVisitAt: null,
      ...near(50),
    }),
    prospect({ name: "près", ...near(100) }),
    prospect({
      name: "plus tard",
      status: "follow_up",
      nextVisitAt: NOW + 3 * DAY,
      ...near(10),
    }),
    prospect({ name: "milieu", ...near(400) }),
  ];

  it("orders due stops nearest-next from the stored position, kept for today last", () => {
    const list = buildTodayList(stops(), [], GRAND_PLACE, NOW, []);

    expect(list.now.map((i) => i.name)).toEqual([
      "près",
      "milieu",
      "loin",
      "gardé pour aujourd'hui",
    ]);
    expect(list.now.every((i) => i.distanceM !== null)).toBe(true);
    expect(list.later.map((i) => i.name)).toEqual(["plus tard"]);
  });

  it("keeps due stops in input order when there is no position", () => {
    const list = buildTodayList(stops(), [], null, NOW, []);

    expect(list.now.map((i) => i.name)).toEqual([
      "loin",
      "près",
      "milieu",
      "gardé pour aujourd'hui",
    ]);
    expect(list.now.every((i) => i.distanceM === null)).toBe(true);
  });
});
