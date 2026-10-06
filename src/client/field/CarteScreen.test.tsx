/**
 * Carte's own wiring (spec-gh-121, spec-gh-122): `RoundMap` is mocked, so this
 * only checks what `CarteScreen` feeds it and how it composes the sheet
 * (phone) or the list (tablet) around it — never that Leaflet actually draws
 * (that's `RoundMap.test.tsx`, against the real thing). Covers every matrix
 * row of spec-gh-122 except "Resize", which belongs to `RoundMap.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { copy, TYPE_LABELS } from "../copy";
import type { TodayItem, TodayList } from "../../shared/today";
import type { RoundState } from "./useRound";

const round = vi.hoisted(() => ({
  current: {
    list: { now: [], later: [] } as TodayList,
    point: null,
    locating: false,
    denied: false,
    refresh: vi.fn(),
    now: 0,
    outboxVisits: [],
  } as RoundState,
}));
vi.mock("./useRound", () => ({ useRound: () => round.current }));

/** How many times the mocked `RoundMap` has actually mounted (`useEffect`'s
 * empty-deps run), as opposed to merely re-rendered — the two are the same
 * count for a plain `vi.fn()` mock, which is exactly why a remount bug (GH
 * review, "crossing 768px remounts RoundMap") would slip past a call-count
 * assertion alone. */
const mapMounts = vi.hoisted(() => ({ count: 0 }));
vi.mock("./RoundMap", () => ({
  RoundMap: vi.fn(() => {
    useEffect(() => {
      mapMounts.count += 1;
    }, []);
    return <div data-testid="round-map" />;
  }),
}));

// Imported after the mock so this binding is the mocked one.
import { RoundMap } from "./RoundMap";
import { CarteScreen } from "./CarteScreen";

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: crypto.randomUUID(),
  name: "Le Bouchon",
  type: "restaurant",
  lat: 50.8467,
  lng: 4.3525,
  address: "12 rue Sainte-Catherine",
  status: "assigned",
  nextVisitAt: null,
  lastVisitAt: null,
  pending: false,
  distanceM: null,
  visitQueued: false,
  ...over,
});

/** happy-dom's own `matchMedia` matches a 1024px-wide desktop (VisitScreen's
 * own note) — `mobile: false` just makes that explicit for the tablet tests. */
function setViewport(mobile: boolean) {
  return vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: mobile && query === "(width < 768px)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

/** Like `setViewport`, but a single `MediaQueryList` stand-in whose `matches`
 * can flip after render and fire the `change` listener `useIsMobile`
 * registers — so a test can cross the breakpoint without remounting the
 * screen itself. */
function viewportController(initialMobile: boolean) {
  let mobile = initialMobile;
  const listeners = new Set<() => void>();
  const mobileQuery = {
    get matches() {
      return mobile;
    },
    media: "(width < 768px)",
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) =>
    query === "(width < 768px)"
      ? (mobileQuery as unknown as MediaQueryList)
      : ({
          matches: false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as unknown as MediaQueryList),
  );
  return {
    setMobile(next: boolean) {
      mobile = next;
      listeners.forEach((cb) => cb());
    },
  };
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={["/tournee/carte"]}>
      <CarteScreen />
    </MemoryRouter>,
  );
}

/** The props of RoundMap's first render — asserted to exist rather than
 * indexed with `!`, since a missing call is exactly the failure this file
 * checks for elsewhere. */
function roundMapProps() {
  const [call] = vi.mocked(RoundMap).mock.calls;
  if (!call) throw new Error("RoundMap was never rendered");
  return call[0];
}

/** Fires the pin tap `RoundMap` would call `onSelect` with. */
function selectPin(id: string) {
  act(() => {
    roundMapProps().onSelect?.(id);
  });
}

function metaText(item: TodayItem): string {
  return copy.today.meta(TYPE_LABELS[item.type], item.address);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mapMounts.count = 0;
  round.current = {
    list: { now: [], later: [] },
    point: null,
    locating: false,
    denied: false,
    refresh: vi.fn(),
    now: 0,
    outboxVisits: [],
  };
});

describe("CarteScreen, phone (< 768px)", () => {
  it("shows the next stop in the sheet, gold number, Y aller and Visiter to /tournee/:id (matrix: Phone, open)", () => {
    setViewport(true);
    const stop = item();
    round.current = { ...round.current, list: { now: [stop], later: [] } };

    renderScreen();

    const sheet = screen.getByRole("region", { name: copy.carte.sheetLabel });
    expect(within(sheet).getByText("1", { selector: "span" }).className).toContain("bg-primary");
    expect(within(sheet).getByText(stop.name)).toBeTruthy();
    expect(within(sheet).getByText(metaText(stop))).toBeTruthy();

    const visit = within(sheet).getByRole("link", { name: copy.today.visit });
    expect(visit.getAttribute("href")).toBe(`/tournee/${stop.id}`);
    expect(within(sheet).getByRole("link", { name: copy.today.navigate })).toBeTruthy();

    // No tablet list pane alongside the sheet, and no duplicate "Visiter".
    expect(screen.queryByRole("region", { name: copy.carte.listLabel })).toBeNull();
    expect(screen.getAllByRole("link", { name: copy.today.visit })).toHaveLength(1);
  });

  it("moves the sheet to the tapped pin's stop, secondary number (matrix: Pin tap)", () => {
    setViewport(true);
    const stop1 = item({ name: "Curry House" });
    const stop2 = item({ name: "Chez Léon" });
    const stop3 = item({ name: "Café des Arts" });
    round.current = { ...round.current, list: { now: [stop1, stop2, stop3], later: [] } };

    renderScreen();
    selectPin(stop3.id);

    const sheet = screen.getByRole("region", { name: copy.carte.sheetLabel });
    expect(within(sheet).getByText("3", { selector: "span" }).className).not.toContain(
      "bg-primary",
    );
    expect(within(sheet).getByText(stop3.name)).toBeTruthy();
    expect(within(sheet).queryByText(stop1.name)).toBeNull();
  });

  it("falls back to the next stop once the selected one leaves the round (matrix: Selected stop leaves)", () => {
    setViewport(true);
    const stop1 = item({ name: "Curry House" });
    const stop3 = item({ name: "Café des Arts" });
    round.current = { ...round.current, list: { now: [stop1, stop3], later: [] } };

    const { rerender } = renderScreen();
    selectPin(stop3.id);
    expect(
      within(screen.getByRole("region", { name: copy.carte.sheetLabel })).getByText(stop3.name),
    ).toBeTruthy();

    // The visit synced away: stop3 is no longer in `list.now`.
    round.current = { ...round.current, list: { now: [stop1], later: [] } };
    rerender(
      <MemoryRouter initialEntries={["/tournee/carte"]}>
        <CarteScreen />
      </MemoryRouter>,
    );

    const sheet = screen.getByRole("region", { name: copy.carte.sheetLabel });
    expect(within(sheet).getByText(stop1.name)).toBeTruthy();
    expect(within(sheet).queryByText(stop3.name)).toBeNull();
  });

  it("shows Visiter full width with no Y aller when the selected stop has no coordinates (matrix: No coordinates)", () => {
    setViewport(true);
    const stop = item({ lat: null, lng: null });
    round.current = { ...round.current, list: { now: [stop], later: [] } };

    renderScreen();

    const sheet = screen.getByRole("region", { name: copy.carte.sheetLabel });
    expect(within(sheet).queryByRole("link", { name: copy.today.navigate })).toBeNull();
    expect(within(sheet).getByRole("link", { name: copy.today.visit })).toBeTruthy();
  });

  it("shows the empty message and no actions for an empty round (matrix: Empty round)", () => {
    setViewport(true);
    renderScreen();

    const sheet = screen.getByRole("region", { name: copy.carte.sheetLabel });
    expect(within(sheet).getByText(copy.today.empty)).toBeTruthy();
    expect(within(sheet).queryByRole("link", { name: copy.today.visit })).toBeNull();
  });

  it("shows the distance and the Pas encore envoyé badge in the sheet", () => {
    setViewport(true);
    const stop = item({ pending: true, distanceM: 350 });
    round.current = { ...round.current, list: { now: [stop], later: [] } };

    renderScreen();

    const sheet = screen.getByRole("region", { name: copy.carte.sheetLabel });
    expect(within(sheet).getByText("350 m")).toBeTruthy();
    expect(within(sheet).getByText(copy.today.notSynced)).toBeTruthy();
  });

  it("shows the offline notice over the canvas and the sheet with the next stop (matrix: Offline phone)", () => {
    setViewport(true);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const stop = item();
    round.current = { ...round.current, list: { now: [stop], later: [] } };

    renderScreen();

    expect(screen.getByText(copy.carte.offline)).toBeTruthy();
    expect(screen.queryByTestId("round-map")).toBeNull();
    expect(RoundMap).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: copy.carte.showList }).getAttribute("href")).toBe(
      "/tournee",
    );
    const sheet = screen.getByRole("region", { name: copy.carte.sheetLabel });
    expect(within(sheet).getByText(stop.name)).toBeTruthy();
  });

  it("feeds RoundMap the round's pins, its position, its own refresh as recentre, and onSelect", () => {
    setViewport(true);
    const stop = item();
    round.current = {
      ...round.current,
      list: { now: [stop], later: [] },
      point: { lat: 50.85, lng: 4.35 },
    };

    renderScreen();

    const props = roundMapProps();
    expect(props.pins).toEqual([
      { id: stop.id, index: 1, lat: 50.8467, lng: 4.3525, next: true, name: stop.name },
    ]);
    expect(props.path).toEqual([[50.8467, 4.3525]]);
    expect(props.position).toBe(round.current.point);
    expect(typeof props.onSelect).toBe("function");

    props.recentre();
    expect(round.current.refresh).toHaveBeenCalledTimes(1);
  });

  it("draws no pin for a Plus tard follow-up", () => {
    setViewport(true);
    const stop = item();
    const later = item({ status: "follow_up", nextVisitAt: Date.now() + 86_400_000 });
    round.current = { ...round.current, list: { now: [stop], later: [later] } };

    renderScreen();

    expect(roundMapProps().pins.map((pin) => pin.id)).toEqual([stop.id]);
  });

  it("shows the position-denied notice over the map, pins still shown, and Réessayer calls refresh", async () => {
    setViewport(true);
    const user = userEvent.setup();
    round.current = { ...round.current, denied: true, list: { now: [item()], later: [] } };

    renderScreen();

    expect(screen.getByText(copy.today.positionDenied)).toBeTruthy();
    expect(screen.getByTestId("round-map")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: copy.today.retryPosition }));
    expect(round.current.refresh).toHaveBeenCalledTimes(1);
  });

  it("swaps the map for the offline notice the instant the network drops, and remounts it once back online", () => {
    setViewport(true);
    round.current = { ...round.current, list: { now: [item()], later: [] } };
    renderScreen();
    expect(screen.getByTestId("round-map")).toBeTruthy();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByText(copy.carte.offline)).toBeTruthy();
    expect(screen.queryByTestId("round-map")).toBeNull();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.getByTestId("round-map")).toBeTruthy();
    expect(screen.queryByText(copy.carte.offline)).toBeNull();
  });
});

describe("CarteScreen, tablet (>= 768px)", () => {
  it("shows the list on the left and the map on the right, with no sheet (matrix: Tablet)", () => {
    setViewport(false);
    const stop1 = item({ name: "Curry House" });
    const stop2 = item({ name: "Chez Léon" });
    round.current = { ...round.current, list: { now: [stop1, stop2], later: [] } };

    renderScreen();

    expect(screen.getByRole("heading", { name: stop1.name })).toBeTruthy();
    expect(screen.getByText(stop2.name)).toBeTruthy();
    expect(screen.getByTestId("round-map")).toBeTruthy();
    expect(screen.queryByRole("region", { name: copy.carte.sheetLabel })).toBeNull();
  });

  it("expands the tapped pin's row and scrolls it into view, collapsing any other; pin 1 scrolls the card (matrix: Tablet pin tap)", () => {
    setViewport(false);
    const stop1 = item({ name: "Curry House" });
    const stop2 = item({ name: "Chez Léon" });
    const stop3 = item({ name: "Café des Arts" });
    round.current = { ...round.current, list: { now: [stop1, stop2, stop3], later: [] } };

    const scrolled: Element[] = [];
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(function (
      this: HTMLElement,
    ) {
      scrolled.push(this);
    });

    renderScreen();

    const row3Toggle = screen.getByRole("button", { name: new RegExp(stop3.name) });
    const row2Toggle = screen.getByRole("button", { name: new RegExp(stop2.name) });
    expect(row3Toggle.getAttribute("aria-expanded")).toBe("false");

    selectPin(stop3.id);

    expect(row3Toggle.getAttribute("aria-expanded")).toBe("true");
    expect(row2Toggle.getAttribute("aria-expanded")).toBe("false");
    expect(scrolled.some((el) => el.textContent?.includes(stop3.name))).toBe(true);

    scrolled.length = 0;
    selectPin(stop1.id);

    expect(row3Toggle.getAttribute("aria-expanded")).toBe("false");
    expect(scrolled.some((el) => el.textContent?.includes(stop1.name))).toBe(true);
  });

  it("expands and collapses a row on its own header tap, independent of any pin tap", () => {
    setViewport(false);
    const stop1 = item({ name: "Curry House" });
    const stop2 = item({ name: "Chez Léon" });
    const stop3 = item({ name: "Café des Arts" });
    round.current = { ...round.current, list: { now: [stop1, stop2, stop3], later: [] } };

    renderScreen();

    const row2Toggle = screen.getByRole("button", { name: new RegExp(stop2.name) });
    const row3Toggle = screen.getByRole("button", { name: new RegExp(stop3.name) });

    fireEvent.click(row2Toggle);
    expect(row2Toggle.getAttribute("aria-expanded")).toBe("true");
    expect(row3Toggle.getAttribute("aria-expanded")).toBe("false");

    // Opening row 3 by its own header closes row 2, same as a pin tap would.
    fireEvent.click(row3Toggle);
    expect(row2Toggle.getAttribute("aria-expanded")).toBe("false");
    expect(row3Toggle.getAttribute("aria-expanded")).toBe("true");

    // Tapping the already-open row's header again collapses it back to "the
    // next stop" (no row expanded).
    fireEvent.click(row3Toggle);
    expect(row3Toggle.getAttribute("aria-expanded")).toBe("false");

    // A pin tap and a header tap drive the same selection either way.
    selectPin(stop2.id);
    expect(row2Toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(row2Toggle);
    expect(row2Toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows the position-denied notice over the map, pins still shown, and Réessayer calls refresh", async () => {
    setViewport(false);
    const user = userEvent.setup();
    round.current = { ...round.current, denied: true, list: { now: [item()], later: [] } };

    renderScreen();

    expect(screen.getByText(copy.today.positionDenied)).toBeTruthy();
    expect(screen.getByTestId("round-map")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: copy.today.retryPosition }));
    expect(round.current.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the list left and the offline notice right (matrix: Tablet offline)", () => {
    setViewport(false);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const stop = item();
    round.current = { ...round.current, list: { now: [stop], later: [] } };

    renderScreen();

    expect(screen.getByRole("heading", { name: stop.name })).toBeTruthy();
    expect(screen.getByText(copy.carte.offline)).toBeTruthy();
    expect(screen.queryByTestId("round-map")).toBeNull();
    expect(RoundMap).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: copy.carte.showList }).getAttribute("href")).toBe(
      "/tournee",
    );
  });

  it("renders an empty map with no pins for an empty round", () => {
    setViewport(false);
    renderScreen();

    expect(screen.getByTestId("round-map")).toBeTruthy();
    expect(roundMapProps().pins).toEqual([]);
  });
});

describe("CarteScreen, crossing the breakpoint", () => {
  it("does not remount RoundMap when the viewport crosses 768px", () => {
    const viewport = viewportController(false);
    round.current = { ...round.current, list: { now: [item()], later: [] } };

    renderScreen();
    expect(mapMounts.count).toBe(1);

    act(() => {
      viewport.setMobile(true);
    });

    expect(screen.getByTestId("round-map")).toBeTruthy();
    expect(mapMounts.count).toBe(1);
  });
});
