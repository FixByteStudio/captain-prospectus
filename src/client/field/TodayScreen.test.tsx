/**
 * The round screen (spec-gh-118, story 1.5 of #496): today's tournée in the
 * swipe's numbers, single-open rows, a visited stop leaving the moment its visit
 * is queued, and the all-done card — all offline, against the real Dexie tables
 * `useRound.ts` reads.
 *
 * `useSyncState` is mocked (as `SyncIndicator.test.tsx` does) so nothing here
 * depends on the sync engine's timers; `useAgentPosition` runs for real and
 * reports "denied" under happy-dom (`test/setup-dom.ts`), which is the
 * no-reading state: the same order, « Position inconnue », no notice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { copy } from "../copy";
import type { FieldProspect, Prospect, Visit } from "../../shared/schemas";
import { fieldDb } from "./db";
import { TodayScreen } from "./TodayScreen";
import {
  clearTourneeTables,
  seedPulledTournee,
  setPhoneClockToTourneeDay,
  TOURNEE_NOW,
} from "./tournee-test-helpers";
import type { SyncState } from "./useSync";

const syncState = vi.hoisted(() => ({
  current: { lastSyncAt: 1_700_000_000_000, identity: "agent@example.com" } as Pick<
    SyncState,
    "lastSyncAt" | "identity"
  >,
}));

vi.mock("./useSync", () => ({
  useSyncState: () => syncState.current,
}));

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

const fieldProspect = (over: Partial<FieldProspect> = {}): FieldProspect => ({
  id: crypto.randomUUID(),
  name: "Food truck du pont",
  type: "food_truck",
  lat: null,
  lng: null,
  address: null,
  phone: null,
  createdAt: Date.now(),
  ...over,
});

const visit = (over: Partial<Visit> = {}): Visit => ({
  id: crypto.randomUUID(),
  prospectId: crypto.randomUUID(),
  visitedAt: TOURNEE_NOW,
  lat: null,
  lng: null,
  flyerGiven: false,
  outcome: "interested",
  followUpAt: null,
  notes: null,
  scriptId: null,
  answers: {},
  ...over,
});

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={["/tournee"]}>
      <TodayScreen />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setPhoneClockToTourneeDay();
  syncState.current = { lastSyncAt: TOURNEE_NOW, identity: "agent@example.com" };
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all([
    fieldDb.prospects.clear(),
    fieldDb.outboxProspects.clear(),
    fieldDb.outboxVisits.clear(),
    clearTourneeTables(),
  ]);
});

const IDS = [1, 2, 3, 4, 5, 6].map((n) => `00000000-0000-4000-8000-00000000000${n}`);

/** Six stops named after their number, so a row's name says which stop it is. */
const six = () => IDS.map((id, i) => prospect({ id, name: `Stop ${i + 1}` }));

/** `noUncheckedIndexedAccess`: a missing fixture is a test bug, not a `undefined` to carry. */
const nth = <T,>(items: readonly T[], i: number): T => {
  const item = items[i];
  if (item === undefined) throw new Error(`no fixture at ${i}`);
  return item;
};

const cardOf = async () => {
  const card = (await screen.findByText(copy.today.nextStop)).closest("article");
  if (!card) throw new Error("no next-stop card");
  return card;
};

describe("TodayScreen", () => {
  it("says nothing is left, not that every stop is done, when the day holds no stop", async () => {
    renderScreen();

    expect(await screen.findByText(copy.today.nothingLeft)).toBeTruthy();
    expect(screen.queryByText(copy.today.allDone)).toBeNull();
    expect(screen.queryByText(copy.today.nextStop)).toBeNull();
    // No « Retrouvez-les » for a day with nothing visited, but Carnet stays one tap away.
    expect(screen.queryByText(copy.today.findInCarnet)).toBeNull();
    expect(screen.getByRole("link", { name: copy.today.openCarnet })).toBeTruthy();
  });

  it("walked in order: the card reads Arrêt 4 and the rows 5 and 6", async () => {
    const stops = six();
    await seedPulledTournee(stops);
    await fieldDb.outboxVisits.bulkAdd(stops.slice(0, 3).map((p) => visit({ prospectId: p.id })));

    renderScreen();

    const card = await cardOf();
    expect(card.getAttribute("aria-label")).toBe(copy.carte.pinLabel(4, "Stop 4"));
    expect(within(card).getByText("4")).toBeTruthy();
    expect(within(card).getByRole("link", { name: copy.today.visit })).toBeTruthy();

    const rows = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-controls"));
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      copy.carte.pinLabel(5, "Stop 5"),
      copy.carte.pinLabel(6, "Stop 6"),
    ]);
    expect(screen.getByLabelText(copy.today.progressLabel(3, 6))).toBeTruthy();
    expect(screen.queryByText(copy.today.remaining(3))).toBeNull();
  });

  it("opens one row at a time and writes nothing (invariant 2)", async () => {
    await seedPulledTournee(six().slice(0, 3));

    const user = userEvent.setup();
    renderScreen();
    await cardOf();

    const rows = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-controls"));
    expect(rows).toHaveLength(2);
    const [rowTwo, rowThree] = rows as [HTMLElement, HTMLElement];
    expect(rowTwo.getAttribute("aria-expanded")).toBe("false");

    await user.click(rowTwo);
    expect(rowTwo.getAttribute("aria-expanded")).toBe("true");
    await user.click(rowThree);
    expect(rowThree.getAttribute("aria-expanded")).toBe("true");
    expect(rowTwo.getAttribute("aria-expanded")).toBe("false");

    expect(await fieldDb.outboxVisits.count()).toBe(0);
    expect(await fieldDb.outboxProspects.count()).toBe(0);
    expect((await fieldDb.prospects.toArray()).every((p) => p.status === "assigned")).toBe(true);
  });

  it("a queued visit takes the stop off Tournée whatever its outcome, with no Plus tard", async () => {
    const stops = six().slice(0, 4);
    await seedPulledTournee(stops);
    await fieldDb.outboxVisits.bulkAdd([
      visit({ prospectId: nth(stops, 0).id, outcome: "converted" }),
      visit({ prospectId: nth(stops, 1).id, outcome: "follow_up", followUpAt: TOURNEE_NOW }),
      visit({
        prospectId: nth(stops, 2).id,
        outcome: "no_contact",
        followUpAt: TOURNEE_NOW + 3 * 86_400_000,
      }),
    ]);

    renderScreen();

    const card = await cardOf();
    expect(within(card).getByText("Stop 4")).toBeTruthy();
    for (const gone of ["Stop 1", "Stop 2", "Stop 3"]) expect(screen.queryByText(gone)).toBeNull();
    expect(screen.queryByText("Plus tard")).toBeNull();
    expect(screen.getByLabelText(copy.today.progressLabel(3, 4))).toBeTruthy();
  });

  it("keeps a stop off the list once the pull lists it as visited and the outbox row is gone", async () => {
    const stops = six().slice(0, 2);
    await seedPulledTournee(stops);
    const queued = visit({ prospectId: nth(stops, 0).id });
    await fieldDb.outboxVisits.add(queued);

    renderScreen();
    expect(await screen.findByLabelText(copy.today.progressLabel(1, 2))).toBeTruthy();

    // The sync: the server accepts the visit and lists the stop as visited today.
    await fieldDb.visitedStops.put({
      prospectId: nth(stops, 0).id,
      outcome: "interested",
      visitedAt: TOURNEE_NOW,
      flyerGiven: false,
      visitIds: [queued.id],
      name: "Stop 1",
      type: "restaurant",
      address: null,
    });
    await fieldDb.outboxVisits.delete(queued.id);

    const card = await cardOf();
    expect(within(card).getByText("Stop 2")).toBeTruthy();
    expect(screen.queryByText("Stop 1")).toBeNull();
    // The same visit on both sides, then on the server alone: still one arrêt.
    expect(screen.getByLabelText(copy.today.progressLabel(1, 2))).toBeTruthy();
  });

  it("another agent's outbox visit leaves the stop on the list", async () => {
    const stops = six().slice(0, 2);
    await seedPulledTournee(stops);
    await fieldDb.outboxVisits.add({
      ...visit({ prospectId: nth(stops, 0).id }),
      writtenBy: "autre@example.com",
    });

    renderScreen();

    expect(await screen.findByLabelText(copy.today.progressLabel(0, 2))).toBeTruthy();
  });

  it("a follow-up kept for today stays in its number, never sorted last", async () => {
    const stops = six();
    await seedPulledTournee([
      { ...nth(stops, 0), status: "follow_up", lastVisitAt: TOURNEE_NOW, nextVisitAt: TOURNEE_NOW },
      nth(stops, 1),
    ]);

    renderScreen();

    expect((await cardOf()).getAttribute("aria-label")).toBe(copy.carte.pinLabel(1, "Stop 1"));
  });

  it("marks a field prospect not yet accepted", async () => {
    const field = fieldProspect({ name: "Camion à tacos" });
    await fieldDb.outboxProspects.add(field);
    const tourneeId = crypto.randomUUID();
    await fieldDb.tournees.put({ id: tourneeId, dayStart: 0, startedAt: TOURNEE_NOW });
    await fieldDb.outboxTournees.add({ id: tourneeId, startedAt: TOURNEE_NOW });
    await fieldDb.outboxStops.add({
      id: crypto.randomUUID(),
      tourneeId,
      prospectId: field.id,
      number: 3,
      addedAt: TOURNEE_NOW,
    });

    renderScreen();

    const card = await cardOf();
    expect(within(card).getByText("3")).toBeTruthy();
    expect(within(card).getByText(copy.today.notSynced)).toBeTruthy();
  });

  it("keeps the numbers and the order with no position, and shows no notice", async () => {
    await seedPulledTournee(six().slice(0, 3), { numbers: [4, 2, 9] });

    renderScreen();

    expect((await cardOf()).getAttribute("aria-label")).toBe(copy.carte.pinLabel(2, "Stop 2"));
    expect(await screen.findAllByText(copy.today.distanceUnknown)).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
    expect(screen.queryByText(/triée par distance/)).toBeNull();
  });

  it("expands a row from the keyboard, with either Enter or Space", async () => {
    await seedPulledTournee(six().slice(0, 2));

    const user = userEvent.setup();
    renderScreen();

    await cardOf();
    const row = screen.getByRole("button", { name: copy.carte.pinLabel(2, "Stop 2") });

    row.focus();
    expect(document.activeElement).toBe(row);
    await user.keyboard("{Enter}");
    expect(row.getAttribute("aria-expanded")).toBe("true");

    await user.keyboard(" ");
    expect(row.getAttribute("aria-expanded")).toBe("false");
  });

  /** The server's door-days for the first `count` prospects, as a pull leaves them. */
  const pullVisited = (stops: readonly Prospect[], count: number) =>
    fieldDb.visitedStops.bulkPut(
      stops.slice(0, count).map((p) => ({
        prospectId: p.id,
        outcome: "interested" as const,
        visitedAt: TOURNEE_NOW,
        flyerGiven: false,
        visitIds: [crypto.randomUUID()],
        name: p.name,
        type: p.type,
        address: null,
      })),
    );

  const twenty = () =>
    Array.from({ length: 20 }, (_, i) =>
      prospect({
        id: `00000000-0000-4000-8000-0000000002${String(i).padStart(2, "0")}`,
        name: `Stop ${i + 1}`,
      }),
    );

  it("reads 15 sur 20 from the pulled visits, and a second visit does not move it", async () => {
    const stops = twenty();
    await seedPulledTournee(stops);
    await pullVisited(stops, 15);

    renderScreen();

    expect(await screen.findByText("15")).toBeTruthy();
    expect(screen.getByText(copy.today.progressOf(20))).toBeTruthy();
    const bar = screen.getByLabelText(copy.today.progressLabel(15, 20));
    expect(bar.getAttribute("aria-valuenow")).toBe("75");
    expect(screen.queryByText(/portes/)).toBeNull();

    // A second visit to stop 3: the counter stays.
    await fieldDb.outboxVisits.add(visit({ prospectId: nth(stops, 2).id }));
    // A first visit to stop 16: it rises.
    await fieldDb.outboxVisits.add(visit({ prospectId: nth(stops, 15).id }));
    expect(await screen.findByLabelText(copy.today.progressLabel(16, 20))).toBeTruthy();
  });

  it("reads 15 sur 20 again after a cache wipe once a sync pulls the visited stops", async () => {
    const stops = twenty();
    await seedPulledTournee(stops);

    renderScreen();
    expect(await screen.findByLabelText(copy.today.progressLabel(0, 20))).toBeTruthy();

    await pullVisited(stops, 15);
    expect(await screen.findByLabelText(copy.today.progressLabel(15, 20))).toBeTruthy();
  });

  it("counts an unsent visit before any sync and drops it with the outbox row", async () => {
    const stops = six().slice(0, 5);
    await seedPulledTournee(stops);

    renderScreen();
    expect(await screen.findByLabelText(copy.today.progressLabel(0, 5))).toBeTruthy();

    const queued = visit({ prospectId: nth(stops, 2).id });
    await fieldDb.outboxVisits.add(queued);
    expect(await screen.findByLabelText(copy.today.progressLabel(1, 5))).toBeTruthy();
  });

  it("shows no progress line on an empty round", async () => {
    renderScreen();

    await screen.findByText(copy.today.nothingLeft);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("drops a stop the server marks left, and the count falls by one", async () => {
    const stops = six();
    await seedPulledTournee(stops);
    await fieldDb.tourneeStops
      .filter((s) => s.prospectId === nth(stops, 6 - 1).id)
      .modify({ left: true });

    renderScreen();

    const card = await cardOf();
    expect(card.getAttribute("aria-label")).toBe(copy.carte.pinLabel(1, "Stop 1"));
    expect(screen.queryByText("Stop 6")).toBeNull();
    expect(screen.getByLabelText(copy.today.progressLabel(0, 5))).toBeTruthy();
  });

  it("keeps the card on Arrêt 4 when stop 7 leaves a walked tournée", async () => {
    const stops = Array.from({ length: 7 }, (_, i) =>
      prospect({ id: `00000000-0000-4000-8000-0000000001${i}0`, name: `Stop ${i + 1}` }),
    );
    await seedPulledTournee(stops);
    await fieldDb.outboxVisits.bulkAdd(stops.slice(0, 3).map((p) => visit({ prospectId: p.id })));
    await fieldDb.tourneeStops
      .filter((s) => s.prospectId === nth(stops, 6).id)
      .modify({ left: true });

    renderScreen();

    const card = await cardOf();
    expect(card.getAttribute("aria-label")).toBe(copy.carte.pinLabel(4, "Stop 4"));
    expect(screen.queryByText("Stop 7")).toBeNull();
    expect(screen.getByLabelText(copy.today.progressLabel(3, 6))).toBeTruthy();
  });

  it("says nothing is left when every stop left unvisited", async () => {
    const stops = six().slice(0, 2);
    await seedPulledTournee(stops);
    await fieldDb.tourneeStops.toCollection().modify({ left: true });

    renderScreen();

    expect(await screen.findByText(copy.today.nothingLeft)).toBeTruthy();
    expect(screen.queryByText(copy.today.allDone)).toBeNull();
  });

  it("marks a stop that joined after the swipe « Nouveau », on the row and on the card", async () => {
    const stops = six().slice(0, 3);
    await seedPulledTournee(stops);
    await fieldDb.tourneeStops
      .filter((s) => s.prospectId === nth(stops, 0).id)
      .modify({
        addedAt: 1_700_000_000_000 + 1_000_000,
      });
    await fieldDb.tourneeStops
      .filter((s) => s.prospectId === nth(stops, 2).id)
      .modify({
        addedAt: 1_700_000_000_000 + 1_000_000,
      });

    renderScreen();

    const card = await cardOf();
    expect(within(card).getByText(copy.today.joiner)).toBeTruthy();
    const rows = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-controls"));
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).queryByText(copy.today.joiner)).toBeNull();
    expect(within(rows[1] as HTMLElement).getByText(copy.today.joiner)).toBeTruthy();
  });

  it("shows a joiner still in the outbox next to the pulled stops, with Pas encore envoyé", async () => {
    const stops = six().slice(0, 2);
    await seedPulledTournee(stops);
    const [tournee] = await fieldDb.tournees.toArray();
    const queued = fieldProspect({ name: "Friterie des Minimes" });
    await fieldDb.outboxProspects.add({ ...queued, writtenBy: "agent@example.com" });
    await fieldDb.outboxStops.add({
      id: crypto.randomUUID(),
      tourneeId: tournee?.id ?? "",
      prospectId: queued.id,
      number: 3,
      addedAt: (tournee?.startedAt ?? 0) + 1,
      writtenBy: "agent@example.com",
    });

    renderScreen();

    const row = (await screen.findByText("Friterie des Minimes")).closest("li");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText(copy.today.joiner)).toBeTruthy();
    expect(within(row as HTMLElement).getByText(copy.today.notSynced)).toBeTruthy();
  });

  it("shows the all-done card, not a card of stops, when every stop has a visit today", async () => {
    const stops = six().slice(0, 2);
    await seedPulledTournee(stops);
    await fieldDb.outboxVisits.bulkAdd(stops.map((p) => visit({ prospectId: p.id })));

    renderScreen();

    expect(await screen.findByText(copy.today.allDone)).toBeTruthy();
    // The counter stays above the card and reads the finished day in full.
    expect(screen.getByLabelText(copy.today.progressLabel(2, 2))).toBeTruthy();
    expect(screen.getByText(copy.today.progressOf(2))).toBeTruthy();
    expect(screen.getByText(copy.today.findInCarnet)).toBeTruthy();
    expect(screen.getByRole("link", { name: copy.today.openCarnet }).getAttribute("href")).toBe(
      "/tournee/carnet",
    );
    expect(screen.queryByText(copy.today.nextStop)).toBeNull();
    expect(screen.queryByRole("link", { name: copy.today.visit })).toBeNull();
  });
});
