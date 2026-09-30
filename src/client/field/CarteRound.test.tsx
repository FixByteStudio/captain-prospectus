/**
 * Carte against the real `useRound()` and the real Dexie tables — GH #239's
 * round-placement.md: `CarteScreen.test.tsx` mocks `useRound` module-wide, so
 * this is the one place Flow 1's climax ("Curry House is gone") is checked on
 * Carte too, not only on Tournée du jour (`TodayScreen.test.tsx`).
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

const visit = (over: Partial<Visit> = {}): Visit => ({
  id: crypto.randomUUID(),
  prospectId: crypto.randomUUID(),
  visitedAt: syncState.current.lastSyncAt ?? Date.now(),
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
  syncState.current = { lastSyncAt: 1_700_000_000_000, identity: "agent@example.com" };
  await Promise.all([fieldDb.prospects.clear(), fieldDb.outboxVisits.clear()]);
});

describe("Carte — round placement (GH #239)", () => {
  it("a queued closed outcome leaves the round: the sheet names a different stop", async () => {
    const first = prospect({ id: "00000000-0000-4000-8000-000000000001", name: "Curry House" });
    const second = prospect({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Bar des Marolles",
    });
    await fieldDb.prospects.bulkAdd([first, second]);
    await fieldDb.outboxVisits.add(visit({ prospectId: first.id, outcome: "interested" }));

    asPhone();
    renderScreen();

    // Both `prospects` and `outboxVisits` are independent live queries, so the
    // round can render once with the first settled and not yet the second;
    // wait for the settled state rather than the first render that mentions
    // either stop.
    await waitFor(() => {
      const sheet = screen.getByRole("region", { name: copy.carte.sheetLabel });
      expect(within(sheet).getByText("Bar des Marolles")).toBeTruthy();
      expect(screen.queryByText("Curry House")).toBeNull();
    });
  });

  it("still shows the round's own empty state once every stop has left it", async () => {
    const solo = prospect({ name: "Curry House" });
    await fieldDb.prospects.add(solo);
    await fieldDb.outboxVisits.add(visit({ prospectId: solo.id, outcome: "converted" }));

    renderScreen();

    expect(await screen.findByText(copy.today.empty)).toBeTruthy();
  });
});
