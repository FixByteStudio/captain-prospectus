/**
 * Which live region a sync strip lands in (GH #83).
 *
 * `sync-view.test.ts` decides every state's tone, message and politeness, but
 * nothing checked that `SyncStrip` puts a strip in the region its `politeness`
 * names, or that the assertive region is the one carrying the button. Swapping
 * the two `StripRegion`s, or unmounting the quiet one, passed CI (GH #65
 * review deferral) — and "session just expired" is exactly the moment a screen
 * reader must announce.
 *
 * `useSyncState` is mocked rather than wrapped in a real `SyncProvider`: the
 * provider runs the sync engine on a timer, and these assertions are about the
 * wiring, not about the engine (already covered by `sync.test.ts`).
 *
 * The strip's two buttons must ask before discarding a dirty field form, the
 * same as the tab bar (#74), so every case renders inside `LeaveGuardProvider`.
 * The pre-existing cases run with a clean form — which also checks that a
 * clean form never asks — and the #74 cases below additionally mount a dirty
 * `DirtyForm`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { copy } from "../copy";
import type { PwaState } from "../pwa";
import { LeaveGuardProvider, useRegisterDirty } from "./leave-guard";
import { reconnectUrl } from "./reconnect-marker";
import { SyncStrip } from "./SyncIndicator";
import type { SyncState } from "./useSync";

/** Stands in for VisitScreen / AddProspectScreen's own dirty registration. */
function DirtyForm() {
  useRegisterDirty(true);
  return null;
}

const syncState = vi.hoisted(() => ({
  current: { status: "ok", running: false, pending: 0 } as Pick<
    SyncState,
    "status" | "running" | "pending"
  >,
}));

vi.mock("./useSync", () => ({
  useSyncState: () => syncState.current,
}));

const PWA: PwaState = {
  needRefresh: false,
  offlineReady: true,
  update: () => {},
  dismiss: () => {},
};

/** Captures where the button sends the browser instead of navigating away. */
const realLocation = Object.getOwnPropertyDescriptor(window, "location");

function stubLocation(href: string, reload: () => void = () => {}) {
  const location = { href, search: "", reload };
  Object.defineProperty(window, "location", { configurable: true, value: location });
  return location;
}

afterEach(() => {
  vi.restoreAllMocks();
  if (realLocation) Object.defineProperty(window, "location", realLocation);
});

function renderStrip(
  state: typeof syncState.current,
  pwa: PwaState = PWA,
  { dirty = false }: { dirty?: boolean } = {},
) {
  syncState.current = state;
  const { container } = render(
    <LeaveGuardProvider>
      {dirty && <DirtyForm />}
      <SyncStrip pwa={pwa} />
    </LeaveGuardProvider>,
  );
  const region = (politeness: "polite" | "assertive") => {
    const node = container.querySelector(`[aria-live="${politeness}"]`);
    if (!node) throw new Error(`no ${politeness} region`);
    return node;
  };
  return { polite: region("polite"), assertive: region("assertive") };
}

describe("SyncStrip", () => {
  it("announces an expired session assertively, with the reconnect button", () => {
    const { polite, assertive } = renderStrip({ status: "auth", running: false, pending: 3 });

    expect(assertive.textContent).toContain(copy.sync.authExpired);
    expect(polite.textContent).toBe("");
    // Only "Se reconnecter" and "Mettre à jour" carry a button (epic context).
    expect(screen.getByRole("button", { name: copy.sync.reconnect })).toBeTruthy();
    expect(assertive.contains(screen.getByRole("button", { name: copy.sync.reconnect }))).toBe(
      true,
    );
  });

  it("sends the reconnect button through Access, marker and all", async () => {
    const user = userEvent.setup();
    const location = stubLocation("https://app.example/tournee");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    renderStrip({ status: "auth", running: false, pending: 3 });

    await user.click(screen.getByRole("button", { name: copy.sync.reconnect }));

    // The marker is what keeps the service worker's navigateFallback out of
    // the way, so the request actually reaches Access (reconnect-marker.ts).
    expect(location.href).toBe(reconnectUrl("https://app.example/tournee"));
  });

  it("takes the waiting build when the update button is tapped", async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    renderStrip(
      { status: "upgrade", running: false, pending: 1 },
      { ...PWA, needRefresh: true, update },
    );

    await user.click(screen.getByRole("button", { name: copy.update.apply }));

    expect(update).toHaveBeenCalledOnce();
  });

  it("keeps waiting writes in the polite region, with no button", () => {
    const { polite, assertive } = renderStrip({ status: "ok", running: false, pending: 2 });

    expect(polite.textContent).toContain(copy.sync.pending(2));
    expect(assertive.textContent).toBe("");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps both regions mounted and empty when everything is synced", () => {
    const { polite, assertive } = renderStrip({ status: "ok", running: false, pending: 0 });

    // Always mounted: a region a screen reader has never seen does not
    // announce when it appears (SyncIndicator.tsx).
    expect(polite.textContent).toBe("");
    expect(assertive.textContent).toBe("");
  });

  it("asks before reconnecting away from a dirty form, then navigates on Quitter (#74)", async () => {
    const user = userEvent.setup();
    const location = stubLocation("https://app.example/tournee");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    renderStrip({ status: "auth", running: false, pending: 3 }, PWA, { dirty: true });

    await user.click(screen.getByRole("button", { name: copy.sync.reconnect }));

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(location.href).toBe("https://app.example/tournee");

    await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.leave }));
    expect(location.href).toBe(reconnectUrl("https://app.example/tournee"));
  });

  it("neither asks nor navigates reconnecting offline, dirty form or not", async () => {
    const user = userEvent.setup();
    const location = stubLocation("https://app.example/tournee");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderStrip({ status: "auth", running: false, pending: 3 }, PWA, { dirty: true });

    await user.click(screen.getByRole("button", { name: copy.sync.reconnect }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(location.href).toBe("https://app.example/tournee");
  });

  it("asks before applying a waiting build over a dirty form, then updates on Quitter (#74)", async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    renderStrip(
      { status: "upgrade", running: false, pending: 1 },
      { ...PWA, needRefresh: true, update },
      { dirty: true },
    );

    await user.click(screen.getByRole("button", { name: copy.update.apply }));

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(update).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.leave }));
    expect(update).toHaveBeenCalledOnce();
  });

  it("asks before reloading over a dirty form when no build is waiting yet (#74)", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    stubLocation("https://app.example/tournee", reload);
    renderStrip({ status: "upgrade", running: false, pending: 1 }, PWA, { dirty: true });

    await user.click(screen.getByRole("button", { name: copy.update.apply }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.leave }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not navigate on Quitter if the network drops while the dialog is open", async () => {
    const user = userEvent.setup();
    const location = stubLocation("https://app.example/tournee");
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    renderStrip({ status: "auth", running: false, pending: 3 }, PWA, { dirty: true });

    await user.click(screen.getByRole("button", { name: copy.sync.reconnect }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    onLine.mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.leave }));

    expect(location.href).toBe("https://app.example/tournee");
  });
});
