/**
 * Which frame each route and role gets (GH #83).
 *
 * `App.tsx`'s route table is reachable only through JSX, so nothing failed
 * when the `!screens` forbidden route, the `*` not-found route or the
 * `updatePrompt` prop handed to `AdminApp` was deleted (GH #61/#64/#65 review
 * deferrals). The refactor sweep (#67) rewrites exactly this file.
 *
 * The three module boundaries below are mocked rather than run: `./api` for
 * the role (the network is not the subject), `./field/useSync` for sync state
 * (the engine has its own tests, and a real provider would put every
 * assertion behind its timers), `virtual:pwa-register/react` so `usePwa` — the
 * real one — reports a waiting build, and `./admin/AdminApp` so an admin route
 * does not drag TanStack Query, sonner and PapaParse into a shell test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import type * as ApiModule from "./api";
import type * as AddProspectModule from "./field/AddProspectScreen";
import type { MeResponse, Prospect, Visit } from "../shared/schemas";
import { App } from "./App";
import { copy } from "./copy";
import { brusselsPeriod } from "../shared/period";
import { formatBrusselsWeekday } from "./format";
import { fieldDb, getMeta, setMeta } from "./field/db";
import type { SyncState } from "./field/useSync";

type SyncStub = Pick<SyncState, "status" | "running" | "pending">;

const AGENT: MeResponse = { email: "agent@example.com", role: "agent" };
const OTHER_AGENT: MeResponse = { email: "other@example.com", role: "agent" };
const ADMIN: MeResponse = { email: "admin@example.com", role: "admin" };

const visit = (over: Partial<Visit> = {}): Visit => ({
  id: crypto.randomUUID(),
  prospectId: crypto.randomUUID(),
  visitedAt: 1_700_000_000_000,
  lat: null,
  lng: null,
  flyerGiven: true,
  outcome: "interested",
  followUpAt: null,
  notes: null,
  scriptId: null,
  answers: {},
  ...over,
});
const QUIET: SyncStub = { status: "ok", running: false, pending: 0 };

const stub = vi.hoisted(() => ({
  me: { email: "agent@example.com", role: "agent" } as MeResponse,
  sync: { status: "ok", running: false, pending: 0 } as Pick<
    SyncState,
    "status" | "running" | "pending"
  >,
  needRefresh: false,
  /** True while `/api/me` should never settle, for the loading-state case. */
  identityPending: false,
  /** True while `/api/me` should fail unreachably, for the error-state case. */
  identityUnreachable: false,
  /** True while `/api/me` should answer the Worker's own 401 (GH #309). */
  identityUnauthorized: false,
  /** Counts every `/api/me` fetch, so a test can pin that a live-confirmed
   * session going offline and back costs it no extra request (spec-gh-115). */
  identityCalls: 0,
  /** What the sync engine last stamped, on the phone's clock; null before any sync. */
  lastSyncAt: null as number | null,
  /** True to render the real add-prospect form instead of the dirty-form stand-in. */
  realAddProspect: false,
}));

/** What a revoked session's `ApiError` carries. A fixture, not UI copy:
 * `resolveIdentity` passes the server's own message to the error frame, so the
 * test asserts whatever it was handed rather than `api.ts`'s literal. */
const REVOKED_MESSAGE = "Session révoquée (fixture)";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    apiFetch: () => {
      stub.identityCalls += 1;
      if (stub.identityPending) return new Promise(() => {});
      if (stub.identityUnauthorized)
        return Promise.reject(new actual.ApiError(401, "unauthorized", REVOKED_MESSAGE));
      // Not an ApiError: a bare failure is "unreachable", which with no cached
      // identity is resolveIdentity's offline-first-run error (identity.ts).
      if (stub.identityUnreachable) return Promise.reject(new Error("unreachable"));
      return Promise.resolve(stub.me);
    },
  };
});

vi.mock("./field/useSync", () => ({
  SyncProvider: ({ children }: { children: React.ReactNode }) => children,
  useSyncState: () => ({ ...stub.sync, lastSyncAt: stub.lastSyncAt, syncNow: async () => {} }),
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [stub.needRefresh, () => {}],
    offlineReady: [true, () => {}],
    updateServiceWorker: async () => {},
  }),
}));

// The real form needs a prospect list and react-hook-form; the leave guard only
// needs its dirty registration (GH #356).
vi.mock("./field/AddProspectScreen", async (importOriginal) => {
  const { useRegisterDirty } = await import("./field/leave-guard");
  const actual = await importOriginal<typeof AddProspectModule>();
  const DirtyForm = () => {
    useRegisterDirty(true);
    return <p>dirty form</p>;
  };
  return {
    // Only the midnight cases save through the real form.
    AddProspectScreen: () => (stub.realAddProspect ? <actual.AddProspectScreen /> : <DirtyForm />),
  };
});

vi.mock("./admin/AdminApp", () => ({
  AdminApp: ({ updatePrompt }: { email: string; updatePrompt: React.ReactNode }) => (
    <div data-testid="admin-frame">{updatePrompt}</div>
  ),
}));

/** The router's own pathname, so a redirect is asserted, not inferred. */
function CurrentPath() {
  return <p data-testid="pathname">{useLocation().pathname}</p>;
}

function renderApp(path: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <App />
      <CurrentPath />
    </MemoryRouter>,
  );
}

/** Present only inside `FieldFrame` (its `FieldTabs`), never in the admin frame. */
const fieldBand = () => screen.queryByRole("navigation", { name: copy.nav.tabsLabel });

/**
 * A cache-started case's fixture: the browser genuinely reports no network at
 * mount (`useOnline`'s own seed, `navigator.onLine !== false`), the same as
 * the real "opened this offline" case `identity-access.md` describes — not
 * merely a `stub.identityUnreachable` that happens to coincide with
 * `navigator.onLine` staying `true` (a Worker 500, say), which is the *other*
 * re-check trigger and would fire the moment the identity settles, before the
 * case gets to dispatch its own `online` event. Callers restore the spy in a
 * `finally`.
 */
function mockOffline() {
  return vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
}

/**
 * The band header `Band` draws, by the two classes that are its whole job:
 * `.safe-top` on the header for the notch inset, `h-band-height` on the row
 * inside it for the 56px (GH #59 retro, F1). Class-based because the band is
 * a plain `<header>` with no accessible name of its own — the brand text and
 * the tab nav inside it are asserted separately above.
 */
function bandHeader(container: HTMLElement) {
  return container.querySelector("header.safe-top.bg-band > .h-band-height");
}

/**
 * A tournée pulled for today, so the gate is open and the field frame shows its
 * tabs. The gate cases below clear it to test the screens before the swipe.
 */
async function openGate() {
  await setMeta(fieldDb, "lastSyncAt", Date.now());
  await fieldDb.tournees.put({
    id: crypto.randomUUID(),
    dayStart: brusselsPeriod(Date.now(), 1).from,
    startedAt: Date.now(),
    clientStartedAt: Date.now(),
  });
}

// `stub` is module scope and every case writes to it, so without this the
// suite would only pass in the order it happens to be written in. The Dexie
// row goes too: `App`'s identity effect writes `meta.identity` without
// awaiting it, so a case's write can land during the next one and make it
// look like a different agent just signed in.
beforeEach(async () => {
  // Cleared here as well as in `afterEach`: the write above is not awaited,
  // so it can land *after* the clear that was meant to catch it. The
  // identity-error case below reads `offlineFirstRun` only with nothing
  // cached (identity.ts), so for that one the row decides the outcome.
  await fieldDb.meta.clear();
  await fieldDb.tournees.clear();
  await fieldDb.outboxTournees.clear();
  await fieldDb.prospects.clear();
  await openGate();
  stub.me = AGENT;
  stub.sync = QUIET;
  stub.needRefresh = false;
  stub.identityPending = false;
  stub.identityUnreachable = false;
  stub.identityUnauthorized = false;
  stub.identityCalls = 0;
  stub.lastSyncAt = null;
  stub.realAddProspect = false;
});

afterEach(async () => {
  await fieldDb.meta.clear();
  await fieldDb.tournees.clear();
});

describe("App routing", () => {
  it("renders /login outside the identity gate: its own single /api/me check, no field frame", async () => {
    stub.identityUnauthorized = true;
    renderApp("/login");
    expect(await screen.findByText(copy.login.title)).toBeTruthy();
    expect(stub.identityCalls).toBe(1);
    expect(fieldBand()).toBeNull();
  });

  it("marks main busy while /api/me is still in flight", () => {
    stub.identityPending = true;
    const { container } = renderApp("/");

    // Not the field band's nav: FieldTabs needs `me` to decide `entry`, so it
    // cannot render yet. That the band itself is there — GH #67 review: a
    // bandless loading frame flashed blank before every field session until
    // it was added — is asserted in "App band header" below.
    expect(fieldBand()).toBeNull();
    const main = container.querySelector("main");
    expect(main?.getAttribute("aria-busy")).toBe("true");
  });

  it("sends an agent from / to the round, in the field frame", async () => {
    renderApp("/");

    // The band appears only once identity has settled and the redirect has run.
    expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
    expect(screen.getByTestId("pathname").textContent).toBe("/tournee");
    expect(screen.queryByTestId("admin-frame")).toBeNull();
  });

  it("sends an online admin from / to the admin side, in the admin frame", async () => {
    stub.me = ADMIN;
    renderApp("/");

    expect(await screen.findByTestId("admin-frame")).toBeTruthy();
    expect(screen.getByTestId("pathname").textContent).toBe("/admin");
    expect(fieldBand()).toBeNull();
  });

  it("answers an agent on an admin route with the forbidden state, inside the field frame", async () => {
    renderApp("/admin/prospects");

    expect(await screen.findByText(copy.errors.forbidden)).toBeTruthy();
    // Not a redirect: the agent stays where they are, with a way back.
    expect(screen.getByTestId("pathname").textContent).toBe("/admin/prospects");
    expect(screen.getByRole("link", { name: copy.visit.back }).getAttribute("href")).toBe(
      "/tournee",
    );
    // The tabs wait for the gate's answer from Dexie, so they arrive a beat after the text.
    expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
    expect(screen.queryByTestId("admin-frame")).toBeNull();
  });

  it("answers an unknown path with the not-found state, inside the field frame", async () => {
    stub.me = ADMIN;
    renderApp("/nulle-part");

    expect(await screen.findByText(copy.errors.notFound)).toBeTruthy();
    expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
  });
});

/**
 * The tournée gate (ADR-0036, docs/design.md › Before the swipe): one screen per
 * gate, none with a tab bar, the band and the sync always there.
 */
describe("The tournée gate", () => {
  const assigned = (over: Partial<Prospect> = {}): Prospect => ({
    id: crypto.randomUUID(),
    name: "Bar des Marolles",
    type: "bar",
    lat: null,
    lng: null,
    address: null,
    phone: null,
    website: null,
    cuisine: null,
    source: "csv",
    status: "assigned",
    assignedTo: AGENT.email,
    lastVisitAt: null,
    nextVisitAt: null,
    ...over,
  });

  beforeEach(async () => {
    await fieldDb.tournees.clear();
  });

  it("says the tournée was never loaded when no pull ever succeeded, with no tabs", async () => {
    await fieldDb.meta.delete("lastSyncAt");
    const { container } = renderApp("/tournee");

    expect(await screen.findByText(copy.start.neverLoadedTitle)).toBeTruthy();
    expect(screen.getByText(copy.start.neverLoadedBody)).toBeTruthy();
    expect(fieldBand()).toBeNull();
    // The frame stays: the band is there, and the sync with it.
    expect(bandHeader(container)).toBeTruthy();
  });

  it("says nothing is assigned after a pull with an empty snapshot", async () => {
    renderApp("/tournee");

    expect(await screen.findByText(copy.start.nothingAssignedTitle)).toBeTruthy();
    expect(fieldBand()).toBeNull();
  });

  it("shows the start screen, the count and the swipe, with no tabs, when there is work and no tournée", async () => {
    await fieldDb.prospects.bulkPut([assigned(), assigned({ name: "Chez Marcel" })]);
    renderApp("/tournee");

    // `hidden`: the location dialog is open over the start screen, so the page behind it is aria-hidden.
    expect(
      await screen.findByRole("button", { name: copy.start.swipeName, hidden: true }),
    ).toBeTruthy();
    expect(screen.getByText("2 arrêts")).toBeTruthy();
    expect(fieldBand()).toBeNull();
  });

  it("gates a deep link to a stop the same way", async () => {
    await fieldDb.prospects.put(assigned());
    renderApp("/tournee/carte");

    expect(
      await screen.findByRole("button", { name: copy.start.swipeName, hidden: true }),
    ).toBeTruthy();
    // Neither the Carte subtitle nor the tabs speak for a screen that stands in for the tab.
    expect(screen.queryByText(copy.nav.subtitle.map)).toBeNull();
    expect(fieldBand()).toBeNull();
  });

  it("gives a no-tournée message no tab subtitle either", async () => {
    renderApp("/tournee/nouveau");

    expect(await screen.findByText(copy.start.nothingAssignedTitle)).toBeTruthy();
    expect(screen.queryByText(copy.nav.subtitle.add)).toBeNull();
  });

  it("reads a swipe made now as today's on the phone's clock, whatever the last pull's server time says", async () => {
    await setMeta(fieldDb, "lastSyncAt", Date.now() - 2 * 86_400_000);
    await fieldDb.prospects.put(assigned());
    await fieldDb.outboxTournees.put({
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      writtenBy: AGENT.email,
    });
    renderApp("/tournee");

    expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.start.swipeName, hidden: true })).toBeNull();
  });

  it("keeps the unsent-visits strip on the start screen: the sync is never gated", async () => {
    await fieldDb.prospects.put(assigned());
    await fieldDb.outboxVisits.put({ ...visit(), writtenBy: AGENT.email });
    stub.sync = { status: "ok", running: false, pending: 1 };
    renderApp("/tournee");

    expect(
      await screen.findByRole("button", { name: copy.start.swipeName, hidden: true }),
    ).toBeTruthy();
    expect(screen.getAllByText(copy.sync.pending(1)).length).toBeGreaterThan(0);
    await fieldDb.outboxVisits.clear();
  });

  it("opens the app on this agent's queued tournée, without the start screen", async () => {
    await fieldDb.prospects.put(assigned());
    await fieldDb.outboxTournees.put({
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      writtenBy: AGENT.email,
    });
    renderApp("/tournee");

    expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.start.swipeName, hidden: true })).toBeNull();
  });

  it("opens the app when a pull returns today's tournée, as a second phone does", async () => {
    await openGate();
    renderApp("/tournee");

    expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.start.swipeName, hidden: true })).toBeNull();
  });

  it("does not open on another agent's queued tournée", async () => {
    await fieldDb.prospects.put(assigned());
    await fieldDb.outboxTournees.put({
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      writtenBy: OTHER_AGENT.email,
    });
    renderApp("/tournee");

    expect(
      await screen.findByRole("button", { name: copy.start.swipeName, hidden: true }),
    ).toBeTruthy();
    expect(fieldBand()).toBeNull();
  });

  it("gives an online admin the way back on a gate screen", async () => {
    stub.me = ADMIN;
    renderApp("/tournee");

    const link = await screen.findByRole("link", { name: copy.nav.tabs.dashboard });
    expect(link.getAttribute("href")).toBe("/admin");
    expect(fieldBand()).toBeNull();
  });

  /**
   * Midnight brings the gates back (#505, docs/design.md › Midnight). The clock
   * is faked from 23:59:30 on 14 October 2026 (Brussels, UTC+2).
   *
   * Only `Date` is faked, and `crossTo` moves it and wakes the field clock the
   * way a page becoming visible does: faking `setTimeout` as well would hang
   * Testing Library's and user-event's own settling timers, and the one-shot
   * timer has its own test (`field-clock.test.ts`). The first case runs the real
   * timer end to end, with the shim `waitFor` needs to advance a fake clock.
   */
  describe("at Brussels midnight", () => {
    const EVE = Date.UTC(2026, 9, 14, 21, 59, 30);
    const MIDNIGHT = Date.UTC(2026, 9, 14, 22, 0, 0);
    const weekdayOf = formatBrusselsWeekday;
    /** The prospect a visit form opens on, assigned so it is also the next day's snapshot. */
    const BAR = assigned({ id: "44444444-4444-4444-8444-444444444444", name: "Bar du soir" });

    /** The phone on the eve: a tournée swiped for the 14th, and BAR still open work. */
    async function onTheEve(toFake: ("Date" | "setTimeout" | "clearTimeout")[] = ["Date"]) {
      vi.useFakeTimers({ toFake });
      vi.setSystemTime(EVE);
      await fieldDb.tournees.clear();
      await openGate();
      await fieldDb.prospects.put(BAR);
      stub.lastSyncAt = Date.now();
    }

    /** The clock reads `at`, and the page is visible again: what a phone waking up does. */
    const crossTo = (at: number) => {
      vi.setSystemTime(at);
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
    };
    const swipe = () => screen.findByRole("button", { name: copy.start.swipeName, hidden: true });
    const interestedRadio = () => {
      const radio = screen
        .getAllByRole("radio")
        .find((r) => (r as HTMLInputElement).value === "interested");
      if (!radio) throw new Error("no outcome radio for interested");
      return radio;
    };
    /** The visit form's one-step save: pick an outcome, then confirm. */
    async function saveVisit(user: ReturnType<typeof userEvent.setup>) {
      await user.click(interestedRadio());
      await user.click(screen.getByRole("button", { name: copy.visit.save }));
      const dialog = await screen.findByRole("dialog", { name: copy.visit.confirm.title });
      await user.click(within(dialog).getByRole("button", { name: copy.visit.confirm.save }));
    }

    afterEach(async () => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      await Promise.all([
        fieldDb.outboxVisits.clear(),
        fieldDb.outboxProspects.clear(),
        fieldDb.outboxStops.clear(),
      ]);
    });

    it("gives Tournée way to the new day's start screen, with its date and no tabs", async () => {
      // The field clock's own timer, not a wake-up: Testing Library settles on
      // `setTimeout`, so `jest` stands in for the advance its `waitFor` looks for.
      vi.stubGlobal("jest", { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
      await onTheEve(["Date", "setTimeout", "clearTimeout"]);
      renderApp("/tournee");
      await screen.findByRole("navigation", { name: copy.nav.tabsLabel });

      await act(() => vi.advanceTimersByTimeAsync(30_000));

      expect(await swipe()).toBeTruthy();
      expect(screen.getByText(weekdayOf(MIDNIGHT))).toBeTruthy();
      expect(screen.queryByText(weekdayOf(EVE))).toBeNull();
      expect(screen.getByRole("alertdialog", { name: copy.location.title })).toBeTruthy();
      expect(fieldBand()).toBeNull();
    });

    it.each([
      ["Carte", "/tournee/carte", copy.nav.subtitle.map],
      ["Carnet", "/tournee/carnet", copy.nav.subtitle.carnet],
    ])(
      "gives %s way to the same start screen, with no subtitle of its own",
      async (_n, path, subtitle) => {
        await onTheEve();
        const offline = mockOffline();
        try {
          const { container } = renderApp(path);
          await screen.findByRole("navigation", { name: copy.nav.tabsLabel });
          const named = () => bandHeader(container)?.querySelector(".text-band-muted");
          expect(named()?.textContent).toBe(subtitle);

          crossTo(MIDNIGHT);

          expect(await swipe()).toBeTruthy();
          expect(named()).toBeNull();
          expect(fieldBand()).toBeNull();
        } finally {
          offline.mockRestore();
        }
      },
    );

    it("keeps a visit form that was open, saves at 00:01, then shows the saved line once", async () => {
      await onTheEve();
      const user = userEvent.setup({ delay: null });
      renderApp(`/tournee/${BAR.id}`);
      await screen.findByRole("heading", { name: BAR.name });

      crossTo(MIDNIGHT + 60_000);

      // Nothing moves under the agent's thumb: the form and the tabs stay.
      expect(screen.getByRole("heading", { name: BAR.name })).toBeTruthy();
      expect(screen.getByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
      expect(screen.queryByRole("button", { name: copy.start.swipeName, hidden: true })).toBeNull();

      await saveVisit(user);
      await vi.waitFor(async () => expect(await fieldDb.outboxVisits.count()).toBe(1));
      const [row] = await fieldDb.outboxVisits.toArray();
      expect(row?.visitedAt).toBe(MIDNIGHT + 60_000);
      expect(row?.prospectId).toBe(BAR.id);

      expect(await swipe()).toBeTruthy();
      const dialog = screen.getByRole("alertdialog", { name: copy.location.title });
      expect(dialog.textContent).toContain(copy.visit.saved);
      expect(screen.getByText(weekdayOf(MIDNIGHT))).toBeTruthy();
    });

    it("leaves the save summary open across midnight, and saving behaves the same", async () => {
      await onTheEve();
      const user = userEvent.setup({ delay: null });
      renderApp(`/tournee/${BAR.id}`);
      await screen.findByRole("heading", { name: BAR.name });
      await user.click(interestedRadio());
      await user.click(screen.getByRole("button", { name: copy.visit.save }));
      const dialog = await screen.findByRole("dialog", { name: copy.visit.confirm.title });

      crossTo(MIDNIGHT + 60_000);

      expect(screen.getByRole("dialog", { name: copy.visit.confirm.title })).toBeTruthy();
      await user.click(within(dialog).getByRole("button", { name: copy.visit.confirm.save }));
      await vi.waitFor(async () => expect(await fieldDb.outboxVisits.count()).toBe(1));
      expect(await swipe()).toBeTruthy();
      expect(screen.getByRole("alertdialog", { name: copy.location.title }).textContent).toContain(
        copy.visit.saved,
      );
    });

    it("asks before a tab leaves the held form, and Quitter lands on the start screen", async () => {
      await onTheEve();
      const user = userEvent.setup({ delay: null });
      renderApp("/tournee/nouveau");
      expect(await screen.findByText("dirty form")).toBeTruthy();

      crossTo(MIDNIGHT + 60_000);
      expect(screen.getByText("dirty form")).toBeTruthy();
      await user.click(screen.getByRole("link", { name: copy.nav.tabs.today }));
      await screen.findByText(copy.nav.leaveGuard.title);
      await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.leave }));

      expect(await swipe()).toBeTruthy();
      expect(fieldBand()).toBeNull();
    });

    it("queues an added place and no stop after midnight, and says so on the start screen", async () => {
      await onTheEve();
      stub.realAddProspect = true;
      const user = userEvent.setup({ delay: null });
      renderApp("/tournee/nouveau");
      await user.type(
        await screen.findByRole("textbox", { name: copy.fieldProspect.name }),
        "Chez Nouveau",
      );

      crossTo(MIDNIGHT + 60_000);
      await user.click(screen.getByRole("button", { name: copy.fieldProspect.save }));

      await vi.waitFor(async () => expect(await fieldDb.outboxProspects.count()).toBe(1));
      expect(await fieldDb.outboxStops.count()).toBe(0);
      expect(await swipe()).toBeTruthy();
      expect(screen.getByRole("alertdialog", { name: copy.location.title }).textContent).toContain(
        copy.fieldProspect.saved,
      );
      // The new place is in the new day's snapshot, beside the assigned one.
      expect(screen.getByText(copy.today.remaining(2))).toBeTruthy();
    });

    it("does not hold a form opened while gated: a deep link lands on the start screen", async () => {
      await onTheEve();
      await fieldDb.tournees.clear();
      renderApp(`/tournee/${BAR.id}`);

      expect(await swipe()).toBeTruthy();
      expect(screen.queryByRole("heading", { name: BAR.name })).toBeNull();
      expect(fieldBand()).toBeNull();
    });

    it("says nothing is assigned when the new day has no open work", async () => {
      await onTheEve();
      await fieldDb.prospects.clear();
      renderApp("/tournee");
      await screen.findByRole("navigation", { name: copy.nav.tabsLabel });

      crossTo(MIDNIGHT);

      expect(await screen.findByText(copy.start.nothingAssignedTitle)).toBeTruthy();
      expect(fieldBand()).toBeNull();
    });

    it("takes the new day when a sleeping phone's page becomes visible again", async () => {
      await onTheEve();
      renderApp("/tournee");
      await screen.findByRole("navigation", { name: copy.nav.tabsLabel });

      // The timer never ran: the clock jumped to 07:00 while the phone slept.
      vi.setSystemTime(Date.UTC(2026, 9, 15, 5, 0, 0));
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(await swipe()).toBeTruthy();
      expect(screen.getByText(weekdayOf(MIDNIGHT))).toBeTruthy();
    });

    it("stays on the new day when a sync lands at 00:05", async () => {
      await onTheEve();
      renderApp("/tournee");
      await screen.findByRole("navigation", { name: copy.nav.tabsLabel });
      crossTo(MIDNIGHT);
      expect(await swipe()).toBeTruthy();

      crossTo(MIDNIGHT + 5 * 60_000);
      stub.lastSyncAt = Date.now();
      await setMeta(fieldDb, "lastSyncAt", Date.now());

      expect(await swipe()).toBeTruthy();
      expect(screen.getByText(weekdayOf(MIDNIGHT))).toBeTruthy();
    });

    it("shows no saved line for a save made before midnight, on the same history entry", async () => {
      await onTheEve();
      renderApp("/tournee", { saved: true, savedAt: EVE - 20 * 60_000 });
      await screen.findByRole("navigation", { name: copy.nav.tabsLabel });

      crossTo(MIDNIGHT);

      expect(await swipe()).toBeTruthy();
      const dialog = screen.getByRole("alertdialog", { name: copy.location.title });
      expect(dialog.textContent).not.toContain(copy.visit.saved);
    });

    it("reads the new day when the frame remounts after midnight with the eve's sync last", async () => {
      await onTheEve();
      // An admin back from /admin, offline: the last sync is still yesterday's.
      vi.setSystemTime(Date.UTC(2026, 9, 15, 5, 0, 0));
      renderApp("/tournee");

      expect(await swipe()).toBeTruthy();
      expect(screen.getByText(weekdayOf(MIDNIGHT))).toBeTruthy();
      expect(fieldBand()).toBeNull();
    });

    it("remounts a start screen nobody swiped with the new day's date", async () => {
      await onTheEve();
      await fieldDb.tournees.clear();
      renderApp("/tournee");
      expect(await swipe()).toBeTruthy();
      expect(screen.getByText(weekdayOf(EVE))).toBeTruthy();

      crossTo(MIDNIGHT);

      expect(screen.getByText(weekdayOf(MIDNIGHT))).toBeTruthy();
      expect(screen.queryByText(weekdayOf(EVE))).toBeNull();
      expect(screen.getByRole("alertdialog", { name: copy.location.title })).toBeTruthy();
    });
  });
});

/**
 * The admin gate follows the network (spec-gh-115), rather than the
 * once-at-identity signal `App.tsx` used to compute. `screens` (invariant
 * 10, admin routes) and `entry` (the tab and the `/` redirect,
 * `field/identity.ts`'s `adminAccess`) are asserted separately here because
 * the bug this closes was exactly the two staying conflated.
 */
describe("The admin tab and routes follow the network", () => {
  it("hides the tab the instant the network drops and shows it again the instant it returns, with no second /api/me", async () => {
    stub.me = ADMIN;
    renderApp("/tournee");

    expect(await screen.findByRole("link", { name: copy.nav.tabs.dashboard })).toBeTruthy();
    expect(stub.identityCalls).toBe(1);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.queryByRole("link", { name: copy.nav.tabs.dashboard })).toBeNull();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(await screen.findByRole("link", { name: copy.nav.tabs.dashboard })).toBeTruthy();
    // A session the server already confirmed must not pay for going offline
    // and back — deleting the re-check's `if (!offline) return` would.
    expect(stub.identityCalls).toBe(1);
  });

  it("keeps an admin already on /admin when the network drops — offline hides only the tab", async () => {
    stub.me = ADMIN;
    renderApp("/admin/prospects");

    expect(await screen.findByTestId("admin-frame")).toBeTruthy();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Still there: #97 owns what an offline admin screen then says, not this.
    expect(screen.getByTestId("admin-frame")).toBeTruthy();
    expect(fieldBand()).toBeNull();
  });

  it("sends a live-confirmed admin to /tournee from /, not /admin, when the browser already reports no network at mount", async () => {
    // Pins that `/`'s redirect reads `entry`, not `screens`: this admin is
    // server-confirmed (`screens` true) but the browser never fires an
    // `offline` event here — `navigator.onLine` is already false when the
    // effect first reads it — so only `entry`'s own `online` check catches it.
    const onlineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    try {
      stub.me = ADMIN;
      const { unmount } = renderApp("/");

      expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
      expect(screen.getByTestId("pathname").textContent).toBe("/tournee");
      expect(screen.queryByRole("link", { name: copy.nav.tabs.dashboard })).toBeNull();
      unmount();

      // `screens` is untouched by `online`: the same admin reaching /admin
      // directly still gets the admin frame.
      renderApp("/admin");
      expect(await screen.findByTestId("admin-frame")).toBeTruthy();
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("sends a cache-started admin to the round with no tab, then unlocks both once a re-check confirms them, with no reload", async () => {
    const onlineSpy = mockOffline();
    try {
      await setMeta(fieldDb, "identity", ADMIN);
      stub.me = ADMIN;
      stub.identityUnreachable = true;
      renderApp("/");

      expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
      expect(screen.getByTestId("pathname").textContent).toBe("/tournee");
      expect(screen.queryByRole("link", { name: copy.nav.tabs.dashboard })).toBeNull();
      expect(screen.queryByTestId("admin-frame")).toBeNull();

      // The network returns and this time the server reaches back and confirms
      // the cached admin — the re-check's whole reason to exist.
      stub.identityUnreachable = false;
      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(await screen.findByRole("link", { name: copy.nav.tabs.dashboard })).toBeTruthy();
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("leaves a cache-started admin unchanged when the re-check is unreachable again", async () => {
    const onlineSpy = mockOffline();
    try {
      await setMeta(fieldDb, "identity", ADMIN);
      stub.me = ADMIN;
      stub.identityUnreachable = true;
      renderApp("/");

      expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
      const callsBefore = stub.identityCalls;

      // Awaited: `settle`'s promise chain must flush before the negative
      // assertions below run, or they would also pass if the re-check had
      // wrongly granted the tab (it just hasn't resolved yet).
      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });

      // The re-check ran (falls back to the same cache) but changed nothing.
      expect(stub.identityCalls).toBeGreaterThan(callsBefore);
      expect(screen.queryByRole("link", { name: copy.nav.tabs.dashboard })).toBeNull();
      expect(screen.getByTestId("pathname").textContent).toBe("/tournee");
      expect(screen.queryByTestId("admin-frame")).toBeNull();
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("leaves a cache-started admin with no tab when the re-check answers agent", async () => {
    const onlineSpy = mockOffline();
    try {
      await setMeta(fieldDb, "identity", ADMIN);
      stub.me = ADMIN;
      stub.identityUnreachable = true;
      renderApp("/");

      expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();

      stub.identityUnreachable = false;
      stub.me = AGENT;
      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });

      // The switch drops the admin's cached tournée and last pull with the rest
      // of their cache (`clearAgentCache`), so the agent lands on the
      // never-loaded gate, which has no tab bar and, for an agent, no
      // « Tableau de bord » either.
      expect(await screen.findByText(copy.start.neverLoadedTitle)).toBeTruthy();
      expect(screen.queryByRole("link", { name: copy.nav.tabs.dashboard })).toBeNull();
      expect(screen.getByTestId("pathname").textContent).toBe("/tournee");
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("opens the admin screens for a cache-started admin once the re-check confirms them, with no reload", async () => {
    const onlineSpy = mockOffline();
    try {
      await setMeta(fieldDb, "identity", ADMIN);
      stub.me = ADMIN;
      stub.identityUnreachable = true;
      renderApp("/admin");

      // Cache-sourced, so the admin routes stay shut however admin the cached
      // identity claims to be (invariant 10) — the other half of the tab.
      expect(await screen.findByText(copy.adminRoute.offline)).toBeTruthy();
      expect(screen.queryByTestId("admin-frame")).toBeNull();

      stub.identityUnreachable = false;
      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      // Same URL throughout: the server's answer is what opened them, not a
      // reload and not the cache.
      expect(await screen.findByTestId("admin-frame")).toBeTruthy();
      expect(screen.getByTestId("pathname").textContent).toBe("/admin");
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("takes a cache-started admin to /login, and clears the cache, when the re-check gets a 401", async () => {
    const onlineSpy = mockOffline();
    try {
      await setMeta(fieldDb, "identity", ADMIN);
      stub.me = ADMIN;
      stub.identityUnreachable = true;
      renderApp("/");

      expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();

      // The network returns and the Worker answers 401: this session is revoked,
      // not merely unreachable, so the cache it would otherwise fall back to
      // goes with it (identity-access.md). The outbox is never touched —
      // INVARIANT 5 — and `clearAgentCache` leaves it alone.
      stub.identityUnreachable = false;
      stub.identityUnauthorized = true;
      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(await screen.findByText(copy.login.title)).toBeTruthy();
      expect(screen.getByTestId("pathname").textContent).toBe("/login");
      expect(fieldBand()).toBeNull();
      expect(await getMeta(fieldDb, "identity")).toBeUndefined();
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("tells a cache-started admin on an /admin deep link that the page needs the network, inside the field frame, never that access is denied (GH #209)", async () => {
    const onlineSpy = mockOffline();
    try {
      await setMeta(fieldDb, "identity", ADMIN);
      stub.me = ADMIN;
      stub.identityUnreachable = true;
      renderApp("/admin/prospects");

      expect(await screen.findByText(copy.adminRoute.offline)).toBeTruthy();
      expect(screen.queryByText(copy.errors.forbidden)).toBeNull();
      expect(screen.getByTestId("pathname").textContent).toBe("/admin/prospects");
      expect(screen.getByRole("link", { name: copy.visit.back }).getAttribute("href")).toBe(
        "/tournee",
      );
      expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
      expect(screen.queryByTestId("admin-frame")).toBeNull();
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("gives the same page, not the forbidden state, when /api/me fails while the browser reports a network", async () => {
    // A Worker 5xx or a captive portal: cache-sourced with no `offline` event.
    // The sentence has no wording of its own for it yet (deferred-work.md).
    await setMeta(fieldDb, "identity", ADMIN);
    stub.me = ADMIN;
    stub.identityUnreachable = true;
    renderApp("/admin/prospects");

    expect(await screen.findByText(copy.adminRoute.offline)).toBeTruthy();
    expect(screen.queryByText(copy.errors.forbidden)).toBeNull();
    expect(screen.queryByTestId("admin-frame")).toBeNull();
  });

  it("keeps the forbidden words for the server's answer: a cached agent reads the network page first, then access denied once the re-check confirms the role", async () => {
    const onlineSpy = mockOffline();
    try {
      await setMeta(fieldDb, "identity", AGENT);
      stub.identityUnreachable = true;
      renderApp("/admin/prospects");

      // The cached role is no more proof of "agent" than of "admin"
      // (invariant 10), so it does not get to say who has access.
      expect(await screen.findByText(copy.adminRoute.offline)).toBeTruthy();
      expect(screen.queryByText(copy.errors.forbidden)).toBeNull();

      stub.identityUnreachable = false;
      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(await screen.findByText(copy.errors.forbidden)).toBeTruthy();
      expect(screen.queryByText(copy.adminRoute.offline)).toBeNull();
      expect(screen.getByTestId("pathname").textContent).toBe("/admin/prospects");
    } finally {
      onlineSpy.mockRestore();
    }
  });
});

/**
 * `SyncProvider` is mocked away in this file (its own engine has
 * `useSync.test.tsx`), but `confirmOutbox` (docs/backlog/013) is App's own
 * bookkeeping around the identity effect — real `fieldDb` rows, asserted
 * directly, the same as `getMeta(fieldDb, "identity")` is above.
 */
describe("App confirms an outbox queued while cache-sourced (docs/backlog/013)", () => {
  afterEach(async () => {
    await fieldDb.outboxVisits.clear();
  });

  it("re-stamps an unconfirmed row to whoever /api/me now names, holding an earlier confirmed row back", async () => {
    const onlineSpy = mockOffline();
    try {
      await setMeta(fieldDb, "identity", AGENT);
      stub.me = AGENT;
      stub.identityUnreachable = true;
      renderApp("/tournee");
      await screen.findByRole("navigation", { name: copy.nav.tabsLabel });

      const queuedUnconfirmed = visit();
      await fieldDb.outboxVisits.add({
        ...queuedUnconfirmed,
        writtenBy: AGENT.email,
        unconfirmed: true,
      });
      // Already confirmed, from before this cache-sourced launch: must stay A's.
      const earlier = visit();
      await fieldDb.outboxVisits.add({ ...earlier, writtenBy: AGENT.email });

      // The live answer names a different agent than the cache did.
      stub.identityUnreachable = false;
      stub.me = OTHER_AGENT;
      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });

      // Polls the outbox itself rather than the nav, which was already on
      // screen before this re-check landed and so proves nothing about it.
      await waitFor(async () => {
        expect((await fieldDb.outboxVisits.get(queuedUnconfirmed.id))?.writtenBy).toBe(
          OTHER_AGENT.email,
        );
      });
      const restamped = await fieldDb.outboxVisits.get(queuedUnconfirmed.id);
      expect(restamped?.unconfirmed).toBeUndefined();
      expect(await fieldDb.outboxVisits.get(earlier.id)).toMatchObject({
        writtenBy: AGENT.email,
      });
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("re-stamps to the same identity when the live answer simply confirms it", async () => {
    const onlineSpy = mockOffline();
    try {
      await setMeta(fieldDb, "identity", AGENT);
      stub.me = AGENT;
      stub.identityUnreachable = true;
      renderApp("/tournee");
      await screen.findByRole("navigation", { name: copy.nav.tabsLabel });

      const queued = visit();
      await fieldDb.outboxVisits.add({ ...queued, writtenBy: AGENT.email, unconfirmed: true });

      stub.identityUnreachable = false;
      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });

      await waitFor(async () => {
        expect((await fieldDb.outboxVisits.get(queued.id))?.unconfirmed).toBeUndefined();
      });
      const row = await fieldDb.outboxVisits.get(queued.id);
      expect(row?.writtenBy).toBe(AGENT.email);
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("on a 401, re-stamps to the cached email before the cache is cleared — the outbox survives", async () => {
    const onlineSpy = mockOffline();
    try {
      await setMeta(fieldDb, "identity", AGENT);
      stub.me = AGENT;
      stub.identityUnreachable = true;
      renderApp("/tournee");
      await screen.findByRole("navigation", { name: copy.nav.tabsLabel });

      const queued = visit();
      await fieldDb.outboxVisits.add({ ...queued, writtenBy: AGENT.email, unconfirmed: true });

      // An expired cookie cannot confirm anyone, so the row stays with the
      // identity the agent was shown rather than being left to confirm to
      // nobody (identity-access.md).
      stub.identityUnreachable = false;
      stub.identityUnauthorized = true;
      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });
      await screen.findByText(copy.login.title);

      const row = await fieldDb.outboxVisits.get(queued.id);
      expect(row?.writtenBy).toBe(AGENT.email);
      expect(row?.unconfirmed).toBeUndefined();
      // INVARIANT 5, same as the plain revoked case above: the outbox itself
      // is never touched by `clearAgentCache`.
      await expect(fieldDb.outboxVisits.count()).resolves.toBe(1);
    } finally {
      onlineSpy.mockRestore();
    }
  });

  /**
   * The bug a first version of this confirmation gated on `identityFromCache`
   * being true *this session* missed entirely: a row left `unconfirmed` by an
   * earlier launch that ended (killed, network lost) before its own
   * confirmation landed. The very next launch, even one whose first `/api/me`
   * answers live immediately — never touching the cache-fallback branch at
   * all — must still pick it up, or `sendableBy` refuses it for ever.
   */
  it("confirms a row left unconfirmed by an earlier, already-ended launch, even when this one is live from the start", async () => {
    const queuedByAnEarlierLaunch = visit();
    await fieldDb.outboxVisits.add({
      ...queuedByAnEarlierLaunch,
      writtenBy: AGENT.email,
      unconfirmed: true,
    });

    stub.me = AGENT;
    // Fully live, fully online: `identityFromCache` never becomes true this
    // session, unlike every other case in this file.
    renderApp("/tournee");
    await screen.findByRole("navigation", { name: copy.nav.tabsLabel });

    await waitFor(async () => {
      expect(
        (await fieldDb.outboxVisits.get(queuedByAnEarlierLaunch.id))?.unconfirmed,
      ).toBeUndefined();
    });
    expect(await fieldDb.outboxVisits.get(queuedByAnEarlierLaunch.id)).toMatchObject({
      writtenBy: AGENT.email,
    });
  });

  it("on a 401 that opens the session (no cache fallback this launch either), still releases rows left unconfirmed by different earlier launches", async () => {
    const fromA = visit();
    const fromB = visit();
    await fieldDb.outboxVisits.bulkAdd([
      { ...fromA, writtenBy: AGENT.email, unconfirmed: true },
      { ...fromB, writtenBy: OTHER_AGENT.email, unconfirmed: true },
    ]);

    stub.identityUnauthorized = true;
    renderApp("/tournee");

    await screen.findByText(copy.login.title);
    await waitFor(async () => {
      expect((await fieldDb.outboxVisits.get(fromA.id))?.unconfirmed).toBeUndefined();
      expect((await fieldDb.outboxVisits.get(fromB.id))?.unconfirmed).toBeUndefined();
    });
    // Each row keeps its own writer — a 401 never assumes a single "current"
    // identity to re-stamp everything to.
    expect(await fieldDb.outboxVisits.get(fromA.id)).toMatchObject({ writtenBy: AGENT.email });
    expect(await fieldDb.outboxVisits.get(fromB.id)).toMatchObject({
      writtenBy: OTHER_AGENT.email,
    });
  });
});

describe("App band header", () => {
  // One component, four call sites (GH #59 retro, F1 — it had been written out
  // verbatim at each of them, and the sweep that was closing the epic's gaps
  // added the fourth). These pin the three frames a test can reach; the
  // fourth, `AdminFrameFallback`, needs a real lazy admin chunk and this suite
  // mocks it away.
  it("draws the band in the loading frame, while /api/me is still in flight", () => {
    stub.identityPending = true;
    const { container } = renderApp("/");

    expect(bandHeader(container)?.textContent).toContain(copy.appName);
  });

  it("draws the band in the identity-error frame", async () => {
    stub.identityUnreachable = true;
    const { container } = renderApp("/");

    expect(await screen.findByText(copy.errors.offlineFirstRun)).toBeTruthy();
    expect(bandHeader(container)?.textContent).toContain(copy.appName);
  });

  it("draws the band in the field frame", async () => {
    const { container } = renderApp("/tournee");

    expect(await screen.findByRole("navigation", { name: copy.nav.tabsLabel })).toBeTruthy();
    // The field band's row carries the tabs, the sync dot and the avatar too,
    // so this also pins that they are inside the band and not beside it.
    const band = bandHeader(container);
    expect(band?.textContent).toContain(copy.appName);
    expect(band?.querySelector("nav")).toBeTruthy();
  });

  it("names Carte in the band subtitle on /tournee/carte, not Tournée, and actually renders CarteScreen there rather than falling through to :id (spec-gh-121)", async () => {
    // Offline, so this waits on the lazy chunk itself but not on a real
    // Leaflet map settling — `copy.carte.offline` only ever comes from
    // `CarteScreen`, so seeing it (rather than, say, VisitScreen reading
    // "carte" as a prospect id) is the proof this route resolved to the right
    // screen at all.
    const onlineSpy = mockOffline();
    try {
      const { container } = renderApp("/tournee/carte");

      await screen.findByRole("navigation", { name: copy.nav.tabsLabel });
      const band = bandHeader(container);
      expect(band?.querySelector(".text-band-muted")?.textContent).toBe(copy.nav.subtitle.map);

      expect(await screen.findByText(copy.carte.offline)).toBeTruthy();
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("names Carnet in the band subtitle on /tournee/carnet and renders CarnetScreen, not :id (#504)", async () => {
    const { container } = renderApp("/tournee/carnet");

    await screen.findByRole("navigation", { name: copy.nav.tabsLabel });
    const band = bandHeader(container);
    expect(band?.querySelector(".text-band-muted")?.textContent).toBe(copy.nav.subtitle.carnet);
    expect(await screen.findByRole("heading", { name: copy.carnet.title })).toBeTruthy();
  });
});

describe("App update prompt", () => {
  it("shows the update banner once under the band while the strip is quiet", async () => {
    stub.needRefresh = true;
    renderApp("/tournee");

    // Once: `FieldFrame` renders it, and nothing else on the field side does.
    expect(await screen.findAllByText(copy.update.available)).toHaveLength(1);
  });

  it("hands the banner to the admin frame as its updatePrompt prop", async () => {
    // The admin side has no band to hang it under, so `App` passes the prompt
    // into `AdminApp` instead — the one place that prop is decided.
    stub.me = ADMIN;
    stub.needRefresh = true;
    renderApp("/admin/prospects");

    const frame = await screen.findByTestId("admin-frame");
    expect(frame.textContent).toContain(copy.update.available);
  });

  it("steps aside for the update-needed strip, which carries the button instead", async () => {
    stub.sync = { status: "upgrade", running: false, pending: 1 };
    stub.needRefresh = true;
    const { container } = renderApp("/tournee");

    expect(await screen.findByText(copy.sync.upgrade)).toBeTruthy();
    // hidesUpdateBanner: the strip already says a build is waiting.
    expect(screen.queryByText(copy.update.available)).toBeNull();
    const assertive = container.querySelector('[aria-live="assertive"]');
    expect(assertive?.textContent).toContain(copy.sync.upgrade);
    const button = screen.getByRole("button", { name: copy.update.apply });
    expect(assertive?.contains(button)).toBe(true);
  });
});

describe("App, the Worker's 401 at launch (GH #309)", () => {
  afterEach(async () => {
    await fieldDb.outboxVisits.clear();
  });

  it("opens /login, drops the cached round and identity, and keeps every outbox row", async () => {
    await setMeta(fieldDb, "identity", AGENT);
    await fieldDb.outboxVisits.bulkAdd([visit(), visit()]);
    stub.identityUnauthorized = true;
    renderApp("/tournee");

    expect(await screen.findByText(copy.login.title)).toBeTruthy();
    expect(screen.getByTestId("pathname").textContent).toBe("/login");
    expect(await getMeta(fieldDb, "identity")).toBeUndefined();
    expect(await fieldDb.outboxVisits.count()).toBe(2);
    // Not the error frame, and no marker button.
    expect(screen.queryByText(REVOKED_MESSAGE)).toBeNull();
    expect(screen.queryByRole("button", { name: copy.sync.reconnect })).toBeNull();
  });
});

describe("App, the Worker's 401 on the re-check of a cache-started session (GH #356)", () => {
  afterEach(async () => {
    await fieldDb.outboxVisits.clear();
  });

  /** Opens offline on the cache over a dirty form, then lets the network return with a 401. */
  async function recheckOverDirtyForm() {
    await setMeta(fieldDb, "identity", AGENT);
    await fieldDb.outboxVisits.bulkAdd([visit(), visit()]);
    stub.identityUnreachable = true;
    renderApp("/tournee/nouveau");
    expect(await screen.findByText("dirty form")).toBeTruthy();

    stub.identityUnreachable = false;
    stub.identityUnauthorized = true;
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    return screen.findByText(copy.nav.leaveGuard.title);
  }

  it("asks first; Annuler keeps the form, the cache and the outbox", async () => {
    const onlineSpy = mockOffline();
    try {
      const user = userEvent.setup();
      await recheckOverDirtyForm();
      await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.cancel }));

      expect(screen.getByText("dirty form")).toBeTruthy();
      expect(screen.getByTestId("pathname").textContent).toBe("/tournee/nouveau");
      expect(await getMeta(fieldDb, "identity")).toEqual(AGENT);
      expect(await fieldDb.outboxVisits.count()).toBe(2);
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("asks first; Quitter opens /login, drops the cache and keeps every outbox row", async () => {
    const onlineSpy = mockOffline();
    try {
      const user = userEvent.setup();
      await recheckOverDirtyForm();
      await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.leave }));

      expect(await screen.findByText(copy.login.title)).toBeTruthy();
      expect(screen.getByTestId("pathname").textContent).toBe("/login");
      expect(await getMeta(fieldDb, "identity")).toBeUndefined();
      expect(await fieldDb.outboxVisits.count()).toBe(2);
    } finally {
      onlineSpy.mockRestore();
    }
  });
});

describe("App identity-error frame", () => {
  it("offers no button when the phone simply has never reached the server", async () => {
    stub.identityUnreachable = true;
    renderApp("/tournee");

    expect(await screen.findByText(copy.errors.offlineFirstRun)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
