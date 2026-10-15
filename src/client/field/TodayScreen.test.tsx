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
import { clearTourneeTables, seedPulledTournee, TOURNEE_NOW } from "./tournee-test-helpers";
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
  syncState.current = { lastSyncAt: TOURNEE_NOW, identity: "agent@example.com" };
});

afterEach(async () => {
  await Promise.all([
    fieldDb.prospects.clear(),
    fieldDb.outboxProspects.clear(),
    fieldDb.outboxVisits.clear(),
    fieldDb.sentVisits.clear(),
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
  it("says every stop is done when the tournée has nothing left", async () => {
    renderScreen();

    expect(await screen.findByText(copy.today.allDone)).toBeTruthy();
    expect(screen.queryByText(copy.today.nextStop)).toBeNull();
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
    expect(screen.getByText(copy.today.remaining(3))).toBeTruthy();
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
    expect(screen.getByText(copy.today.remaining(1))).toBeTruthy();
  });

  it("keeps a stop off the list once the pull lists it as visited and the outbox row is gone", async () => {
    const stops = six().slice(0, 2);
    await seedPulledTournee(stops);
    const queued = visit({ prospectId: nth(stops, 0).id });
    await fieldDb.outboxVisits.add(queued);

    renderScreen();
    expect(await screen.findByText(copy.today.remaining(1))).toBeTruthy();

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
    expect(screen.getByText(copy.today.remaining(1))).toBeTruthy();
  });

  it("another agent's outbox visit leaves the stop on the list", async () => {
    const stops = six().slice(0, 2);
    await seedPulledTournee(stops);
    await fieldDb.outboxVisits.add({
      ...visit({ prospectId: nth(stops, 0).id }),
      writtenBy: "autre@example.com",
    });

    renderScreen();

    expect(await screen.findByText(copy.today.remaining(2))).toBeTruthy();
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

  it("reads n portes sur total, denominator held to the round's own size, across a real re-render", async () => {
    const stops = six().slice(0, 5);
    const [first, second, third] = stops as [Prospect, Prospect, Prospect, Prospect, Prospect];
    await seedPulledTournee(stops);
    await fieldDb.sentVisits.bulkAdd([
      {
        id: crypto.randomUUID(),
        prospectId: first.id,
        sentAt: Date.now(),
        writtenBy: "agent@example.com",
      },
      {
        id: crypto.randomUUID(),
        prospectId: second.id,
        sentAt: Date.now(),
        writtenBy: "agent@example.com",
      },
    ]);

    renderScreen();

    expect(await screen.findByText(copy.today.progress(2, 5))).toBeTruthy();

    // A visit queued for a third stop, absent from the log: the outbox side of
    // the union still counts it, so n rises to 3 with the denominator unmoved.
    // The counter still bounds its day by the real clock (entry 7 of #496).
    const thirdVisit = visit({ prospectId: third.id, visitedAt: Date.now() });
    await fieldDb.outboxVisits.add(thirdVisit);
    expect(await screen.findByText(copy.today.progress(3, 5))).toBeTruthy();

    await fieldDb.outboxVisits.delete(thirdVisit.id);
    expect(await screen.findByText(copy.today.progress(2, 5))).toBeTruthy();
  });

  it("shows no progress line on an empty round", async () => {
    renderScreen();

    await screen.findByText(copy.today.allDone);
    expect(screen.queryByLabelText(copy.today.progressLabel)).toBeNull();
  });

  it("shows the all-done card, not a card of stops, when every stop has a visit today", async () => {
    const stops = six().slice(0, 2);
    await seedPulledTournee(stops);
    await fieldDb.outboxVisits.bulkAdd(stops.map((p) => visit({ prospectId: p.id })));

    renderScreen();

    expect(await screen.findByText(copy.today.allDone)).toBeTruthy();
    expect(screen.queryByText(copy.today.nextStop)).toBeNull();
    expect(screen.queryByRole("link", { name: copy.today.visit })).toBeNull();
  });
});
