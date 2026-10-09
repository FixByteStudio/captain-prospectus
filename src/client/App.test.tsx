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
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import type * as ApiModule from "./api";
import type { MeResponse, Visit } from "../shared/schemas";
import { App } from "./App";
import { copy } from "./copy";
import { fieldDb, getMeta, setMeta } from "./field/db";
import { reconnectUrl } from "./field/reconnect-marker";
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
  /** True while `/api/me` should answer with an Access redirect — an expired
   * Access session, which is not the same as being unreachable (identity.ts). */
  identityRevoked: false,
  /** True while `/api/me` should answer the Worker's own 401 (GH #309). */
  identityUnauthorized: false,
  /** Counts every `/api/me` fetch, so a test can pin that a live-confirmed
   * session going offline and back costs it no extra request (spec-gh-115). */
  identityCalls: 0,
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
      if (stub.identityRevoked)
        return Promise.reject(new actual.ApiError(401, "access_redirect", REVOKED_MESSAGE));
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
  useSyncState: () => ({ ...stub.sync, lastSyncAt: null, syncNow: async () => {} }),
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
vi.mock("./field/AddProspectScreen", async () => {
  const { useRegisterDirty } = await import("./field/leave-guard");
  return {
    AddProspectScreen: () => {
      useRegisterDirty(true);
      return <p>dirty form</p>;
    },
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

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
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
  stub.me = AGENT;
  stub.sync = QUIET;
  stub.needRefresh = false;
  stub.identityPending = false;
  stub.identityUnreachable = false;
  stub.identityRevoked = false;
  stub.identityUnauthorized = false;
  stub.identityCalls = 0;
});

afterEach(async () => {
  await fieldDb.meta.clear();
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
    expect(fieldBand()).toBeTruthy();
    expect(screen.queryByTestId("admin-frame")).toBeNull();
  });

  it("answers an unknown path with the not-found state, inside the field frame", async () => {
    stub.me = ADMIN;
    renderApp("/nulle-part");

    expect(await screen.findByText(copy.errors.notFound)).toBeTruthy();
    expect(fieldBand()).toBeTruthy();
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

      await screen.findByRole("navigation", { name: copy.nav.tabsLabel });
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
      expect(await screen.findByText(copy.errors.forbidden)).toBeTruthy();
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

  it("takes a cache-started admin to the identity-error frame, and clears the cache, when the re-check is revoked", async () => {
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
      stub.identityRevoked = true;
      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(await screen.findByText(REVOKED_MESSAGE)).toBeTruthy();
      expect(fieldBand()).toBeNull();
      expect(await getMeta(fieldDb, "identity")).toBeUndefined();
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it("shows the forbidden state, inside the field frame, for a cache-started admin's /admin deep link", async () => {
    await setMeta(fieldDb, "identity", ADMIN);
    stub.me = ADMIN;
    stub.identityUnreachable = true;
    renderApp("/admin/prospects");

    expect(await screen.findByText(copy.errors.forbidden)).toBeTruthy();
    expect(screen.getByTestId("pathname").textContent).toBe("/admin/prospects");
    expect(fieldBand()).toBeTruthy();
    expect(screen.queryByTestId("admin-frame")).toBeNull();
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
      stub.identityRevoked = true;
      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });
      await screen.findByText(REVOKED_MESSAGE);

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

    stub.identityRevoked = true;
    renderApp("/tournee");

    await screen.findByText(REVOKED_MESSAGE);
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
  /** `MemoryRouter` never reads `window.location`, so only the button does. */
  const realLocation = Object.getOwnPropertyDescriptor(window, "location");

  function stubLocation(href: string) {
    const location = { href };
    Object.defineProperty(window, "location", { configurable: true, value: location });
    return location;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    if (realLocation) Object.defineProperty(window, "location", realLocation);
  });

  // A reload is served from precache and asks `/api/me` straight back into
  // the same 401, so the frame must offer the marker navigation (GH #75).
  it("sends a session revoked at startup through Access, marker and all", async () => {
    const user = userEvent.setup();
    stub.identityRevoked = true;
    renderApp("/tournee");

    const button = await screen.findByRole("button", { name: copy.sync.reconnect });
    expect(screen.getByText(REVOKED_MESSAGE)).toBeTruthy();
    const location = stubLocation("https://app.example/tournee");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await user.click(button);

    expect(location.href).toBe(reconnectUrl("https://app.example/tournee"));
  });

  it("stays put when reconnecting with no network", async () => {
    const user = userEvent.setup();
    stub.identityRevoked = true;
    renderApp("/tournee");

    const button = await screen.findByRole("button", { name: copy.sync.reconnect });
    const location = stubLocation("https://app.example/tournee");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await user.click(button);

    expect(location.href).toBe("https://app.example/tournee");
  });

  it("offers no reconnect when the phone simply has never reached the server", async () => {
    stub.identityUnreachable = true;
    renderApp("/tournee");

    expect(await screen.findByText(copy.errors.offlineFirstRun)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
