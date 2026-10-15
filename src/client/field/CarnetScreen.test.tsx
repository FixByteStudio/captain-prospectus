/**
 * Carnet (#504, story 1.8 of #496): today's door-days from the real Dexie tables
 * `useRound` reads, offline. `useSyncState` is mocked, as `TodayScreen.test.tsx`
 * does, so the clock and identity are fixed; the reopen test routes through the
 * real visit form.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { copy, OUTCOME_LABELS, TYPE_LABELS } from "../copy";
import type { Prospect, VisitedStop } from "../../shared/schemas";
import { formatBrusselsTime } from "../format";
import { CarnetScreen } from "./CarnetScreen";
import { fieldDb, type StoredVisit } from "./db";
import { clearTourneeTables, seedPulledTournee, TOURNEE_NOW } from "./tournee-test-helpers";
import { TodayScreen } from "./TodayScreen";
import { tourneeCounter } from "./tournee-stops";
import { VisitScreen } from "./VisitScreen";

const ME = "agent@example.com";

vi.mock("./useSync", () => ({
  useSyncState: () => ({
    lastSyncAt: 1_700_000_000_000,
    identity: "agent@example.com",
    confirmed: true,
    syncNow: async () => {},
  }),
}));

vi.mock("../api", () => ({
  apiFetch: () => Promise.reject(new Error("offline")),
}));

const IDS = [1, 2, 3].map((n) => `00000000-0000-4000-8000-00000000000${n}`);

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
  assignedTo: ME,
  lastVisitAt: null,
  nextVisitAt: null,
  ...over,
});

const stops = () =>
  IDS.map((id, i) => prospect({ id, name: `Stop ${i + 1}`, address: `Rue ${i + 1}` }));

// The fixed clock is 23:13 in Brussels, so "later today" is an hour earlier, never after it.
const AT_10 = TOURNEE_NOW - 3_600_000;
const AT_11 = TOURNEE_NOW - 1_800_000;

const visited = (prospectId: string, over: Partial<VisitedStop> = {}): VisitedStop => ({
  prospectId,
  outcome: "converted",
  visitedAt: AT_10,
  flyerGiven: false,
  visitIds: [crypto.randomUUID()],
  name: "x",
  type: "restaurant",
  address: null,
  ...over,
});

const queued = (prospectId: string, over: Partial<StoredVisit> = {}): StoredVisit => ({
  id: crypto.randomUUID(),
  prospectId,
  visitedAt: AT_11,
  lat: null,
  lng: null,
  flyerGiven: false,
  outcome: "follow_up" as const,
  followUpAt: null,
  notes: null,
  scriptId: null,
  answers: {},
  writtenBy: ME,
  ...over,
});

function renderCarnet(state?: object) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/tournee/carnet", state }]}>
      <Routes>
        <Route path="/tournee" element={<TodayScreen />} />
        <Route path="/tournee/carnet" element={<CarnetScreen />} />
        <Route path="/tournee/:id" element={<VisitScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The rows, top to bottom. */
const rows = () =>
  screen
    .queryAllByRole("link")
    .filter((l) => /Rouvrir/.test(l.ariaLabel ?? l.getAttribute("aria-label") ?? ""));

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all([
    fieldDb.prospects.clear(),
    fieldDb.outboxProspects.clear(),
    fieldDb.outboxVisits.clear(),
    clearTourneeTables(),
  ]);
});

describe("CarnetScreen", () => {
  it("lists converted and no contact, newest first, with numbers and neutral outcome badges", async () => {
    const ps = stops();
    await seedPulledTournee(ps, { numbers: [4, 7, 9] });
    await fieldDb.visitedStops.bulkAdd([
      visited(IDS[0] as string, { name: "Stop 1", outcome: "converted", visitedAt: AT_10 }),
      visited(IDS[1] as string, {
        name: "Stop 2",
        address: "Rue 2",
        outcome: "no_contact",
        visitedAt: AT_11,
      }),
    ]);

    renderCarnet();

    await screen.findByRole("heading", { name: copy.carnet.title });
    await vi.waitFor(() => expect(rows()).toHaveLength(2));
    const [first, second] = rows();
    expect(first?.getAttribute("aria-label")).toBe(
      copy.carnet.rowLabel(7, "Stop 2", OUTCOME_LABELS.no_contact, formatBrusselsTime(AT_11)),
    );
    expect(second?.getAttribute("aria-label")).toBe(
      copy.carnet.rowLabel(4, "Stop 1", OUTCOME_LABELS.converted, formatBrusselsTime(AT_10)),
    );
    expect(within(first as HTMLElement).getByText(OUTCOME_LABELS.no_contact)).toBeTruthy();
    expect(
      within(first as HTMLElement).getByText(`${TYPE_LABELS.restaurant} · Rue 2`),
    ).toBeTruthy();
    expect(within(first as HTMLElement).getByText("7")).toBeTruthy();
    expect(within(first as HTMLElement).queryByText(copy.today.notSynced)).toBeNull();
    // Nothing here shows a count or a day before today.
    expect(screen.queryByText(copy.carnet.visits(1))).toBeNull();
  });

  it("shows « Pas encore envoyé » for an outbox-only visit, linking to the form from Carnet", async () => {
    const ps = stops();
    await seedPulledTournee(ps);
    await fieldDb.outboxVisits.add(queued(IDS[2] as string));

    renderCarnet();

    await vi.waitFor(() => expect(rows()).toHaveLength(1));
    expect(within(rows()[0] as HTMLElement).getByText(copy.today.notSynced)).toBeTruthy();
    expect(rows()[0]?.getAttribute("href")).toBe(`/tournee/${IDS[2]}`);
  });

  it("counts a visit both sides list once, and not pending", async () => {
    const ps = stops();
    await seedPulledTournee(ps);
    const mine = queued(IDS[0] as string);
    await fieldDb.visitedStops.add(visited(IDS[0] as string, { visitIds: [mine.id] }));
    await fieldDb.outboxVisits.add(mine);

    renderCarnet();

    await vi.waitFor(() => expect(rows()).toHaveLength(1));
    const row = rows()[0] as HTMLElement;
    expect(within(row).queryByText(copy.today.notSynced)).toBeNull();
    expect(within(row).queryByText(copy.carnet.visits(2))).toBeNull();
  });

  it("draws a dash ring and an unnumbered label for a prospect with no stop today", async () => {
    const ps = stops();
    const stranger = prospect({ name: "Hors tournée" });
    await seedPulledTournee(ps);
    await fieldDb.prospects.add(stranger);
    await fieldDb.outboxVisits.add(queued(stranger.id));

    renderCarnet();

    await vi.waitFor(() => expect(rows()).toHaveLength(1));
    const row = rows()[0] as HTMLElement;
    expect(row.getAttribute("aria-label")).toBe(
      copy.carnet.rowLabel(
        null,
        "Hors tournée",
        OUTCOME_LABELS.follow_up,
        formatBrusselsTime(AT_11),
      ),
    );
    expect(row.getAttribute("aria-label")).not.toContain("Arrêt");
    expect(within(row).getByText("–").getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps a left stop's number, and lists a closed prospect by its visited stop", async () => {
    const ps = stops();
    await seedPulledTournee(ps);
    await fieldDb.tourneeStops.toCollection().modify({ left: true });
    // Converted, so gone from `prospects`.
    await fieldDb.prospects.delete(IDS[1] as string);
    await fieldDb.visitedStops.add(
      visited(IDS[1] as string, { name: "Chez Marie", type: "bar", address: "Rue Neuve 4" }),
    );

    renderCarnet();

    await vi.waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]?.getAttribute("aria-label")).toContain("Arrêt 2 · Chez Marie");
    expect(screen.getByText(`${TYPE_LABELS.bar} · Rue Neuve 4`)).toBeTruthy();
  });

  it("skips another identity's visit and yesterday's", async () => {
    const ps = stops();
    await seedPulledTournee(ps);
    await fieldDb.outboxVisits.bulkAdd([
      queued(IDS[0] as string, { writtenBy: "other@example.com" }),
      queued(IDS[1] as string, { visitedAt: AT_10 - 86_400_000 }),
    ]);

    renderCarnet();

    await screen.findByText(copy.carnet.empty);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("is an invitation card with no button when nothing was done today", async () => {
    await seedPulledTournee(stops());

    renderCarnet();

    expect(await screen.findByText(copy.carnet.empty)).toBeTruthy();
    expect(screen.getByText(copy.carnet.emptyHint)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the same rows again after a cache wipe and a pull", async () => {
    const ps = stops();
    await seedPulledTournee(ps);
    await fieldDb.visitedStops.add(visited(IDS[0] as string));
    const { unmount } = renderCarnet();
    await vi.waitFor(() => expect(rows()).toHaveLength(1));
    unmount();

    await Promise.all([fieldDb.prospects.clear(), clearTourneeTables()]);
    await seedPulledTournee(ps);
    await fieldDb.visitedStops.add(visited(IDS[0] as string));
    renderCarnet();

    await vi.waitFor(() => expect(rows()).toHaveLength(1));
  });

  it("confirms a save that returned here", async () => {
    await seedPulledTournee(stops());

    renderCarnet({ saved: true });

    expect((await screen.findByRole("status")).textContent).toBe(copy.visit.saved);
  });

  it("reopens a stop, returns here with « 2 visites », and the counter does not move", async () => {
    // Only `Date`: the form stamps the visit with `Date.now()`, which must fall on
    // the fixed clock's day, while Dexie and the user-event timers stay real.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TOURNEE_NOW);
    const user = userEvent.setup();
    const ps = stops();
    await seedPulledTournee(ps, { numbers: [4, 7, 9] });
    await fieldDb.visitedStops.bulkAdd([
      visited(IDS[0] as string, { name: "Stop 1", outcome: "converted", visitedAt: AT_10 }),
      visited(IDS[1] as string, { name: "Stop 2", outcome: "no_contact", visitedAt: AT_11 }),
    ]);
    const counter = async () =>
      tourneeCounter({
        pulledTournees: await fieldDb.tournees.toArray(),
        pulledStops: await fieldDb.tourneeStops.toArray(),
        outboxTournees: [],
        outboxStops: [],
        visitedStops: await fieldDb.visitedStops.toArray(),
        outboxVisits: await fieldDb.outboxVisits.toArray(),
        identity: ME,
        now: TOURNEE_NOW,
      });
    const before = await counter();
    renderCarnet();
    await vi.waitFor(() => expect(rows()).toHaveLength(2));

    await user.click(rows()[0] as HTMLElement);
    expect(await screen.findByRole("link", { name: copy.visit.backToCarnet })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: new RegExp(OUTCOME_LABELS.follow_up) }));
    await user.click(screen.getByRole("radio", { name: copy.visit.whenToday }));
    await user.click(screen.getByRole("button", { name: copy.visit.save }));
    const dialog = await screen.findByRole("dialog", { name: copy.visit.confirm.title });
    await user.click(within(dialog).getByRole("button", { name: copy.visit.confirm.save }));

    expect((await screen.findByRole("status")).textContent).toBe(copy.visit.saved);
    await vi.waitFor(() => {
      const top = rows()[0] as HTMLElement;
      expect(top.getAttribute("aria-label")).toContain("Arrêt 7 · Stop 2 · À relancer");
      expect(within(top).getByText(copy.today.notSynced)).toBeTruthy();
      expect(within(top).getByText(copy.carnet.visits(2))).toBeTruthy();
    });
    expect(rows()).toHaveLength(2);
    expect(await counter()).toEqual(before);
  });
});
