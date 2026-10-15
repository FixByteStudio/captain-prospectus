/**
 * Carte against the real `useRound()` and the real Dexie tables — GH #239 and
 * ADR-0036: `CarteScreen.test.tsx` mocks `useRound` module-wide, so this is the
 * one place a saved stop leaving, and the pins keeping the swipe's numbers, are
 * checked on Carte too, not only on Tournée du jour (`TodayScreen.test.tsx`).
 *
 * `RoundMap` is mocked, as `CarteScreen.test.tsx` does: Leaflet is
 * `RoundMap.test.tsx`'s business.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { copy } from "../copy/field";
import type { Prospect, Visit } from "../../shared/schemas";
import { fieldDb } from "./db";
import { RoundMap } from "./RoundMap";
import { clearTourneeTables, seedPulledTournee, TOURNEE_NOW } from "./tournee-test-helpers";
import { CarteScreen } from "./CarteScreen";
import type { SyncState } from "./useSync";

const syncState = vi.hoisted(() => ({
  current: { lastSyncAt: 1_700_000_000_000, identity: "agent@example.com" } as Pick<
    SyncState,
    "lastSyncAt" | "identity"
  >,
}));
vi.mock("./useSync", () => ({ useSyncState: () => syncState.current }));
vi.mock("../hooks/use-online", () => ({ useOnline: () => true }));
vi.mock("./RoundMap", () => ({ RoundMap: vi.fn(() => <div data-testid="round-map" />) }));

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
  assignedTo: "agent@example.com",
  lastVisitAt: null,
  nextVisitAt: null,
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
    <MemoryRouter initialEntries={["/carte"]}>
      <CarteScreen />
    </MemoryRouter>,
  );
}

/** A phone: `useIsMobile` reads `(width < 768px)`, and only then does Carte
 * render its sheet rather than the tablet list (happy-dom is 1024px wide). */
function asPhone() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === "(width < 768px)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

afterEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  syncState.current = { lastSyncAt: TOURNEE_NOW, identity: "agent@example.com" };
  await Promise.all([
    fieldDb.prospects.clear(),
    fieldDb.outboxVisits.clear(),
    clearTourneeTables(),
  ]);
});

const IDS = [1, 2, 3, 4, 5].map((n) => `00000000-0000-4000-8000-00000000000${n}`);

describe("Carte — the swipe's numbers", () => {
  it("a queued visit leaves the sheet and the map, whatever its outcome, and nothing renumbers", async () => {
    const stops = IDS.map((id, i) => prospect({ id, name: `Stop ${i + 1}` }));
    await seedPulledTournee(stops);
    await fieldDb.outboxVisits.bulkAdd([
      visit({ prospectId: IDS[0], outcome: "converted" }),
      visit({ prospectId: IDS[1], outcome: "follow_up", followUpAt: TOURNEE_NOW }),
      visit({
        prospectId: IDS[2],
        outcome: "no_contact",
        followUpAt: TOURNEE_NOW + 3 * 86_400_000,
      }),
    ]);

    asPhone();
    renderScreen();

    await waitFor(() => {
      const sheet = screen.getByRole("region", { name: copy.carte.sheetLabel });
      expect(within(sheet).getByText("Stop 4")).toBeTruthy();
      expect(within(sheet).getByText("4", { selector: "span" })).toBeTruthy();
    });
    const props = vi.mocked(RoundMap).mock.lastCall?.[0];
    expect(props?.pins.map((pin) => [pin.number, pin.next])).toEqual([
      [4, true],
      [5, false],
    ]);
  });

  it("says every stop is done once the last one has a visit", async () => {
    const solo = prospect({ name: "Curry House" });
    await seedPulledTournee([solo]);
    await fieldDb.outboxVisits.add(visit({ prospectId: solo.id, outcome: "converted" }));

    asPhone();
    renderScreen();

    const sheet = screen.getByRole("region", { name: copy.carte.sheetLabel });
    expect(await within(sheet).findByText(copy.today.allDone)).toBeTruthy();
    expect(vi.mocked(RoundMap).mock.lastCall?.[0].pins).toEqual([]);
  });
});
