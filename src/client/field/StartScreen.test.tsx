/**
 * The start screen and its swipe (docs/design.md › Before the swipe, ADR-0036):
 * the preview, the disabled state, the keyboard path, the drag path, the failed
 * write. `useSyncState` is mocked; Dexie and `useAgentPosition` run for real
 * (geolocation is faked by `test/geolocation.ts`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { setGeolocation } from "../../../test/geolocation";
import { copy } from "../copy";
import type { SnapshotProspect } from "../../shared/tournee";
import { dropReading, setReadingIdentity } from "./last-reading";
import * as db from "./db";
import { fieldDb } from "./db";
import { StartScreen } from "./StartScreen";

const sync = vi.hoisted(() => ({ syncNow: vi.fn(async () => {}), confirmed: true }));
const syncNow = sync.syncNow;

vi.mock("./useSync", () => ({
  useSyncState: () => ({
    identity: "agent@example.com",
    confirmed: sync.confirmed,
    syncNow: sync.syncNow,
  }),
}));

const HERE = { lat: 50.84, lng: 4.35 };

const stop = (i: number, over: Partial<SnapshotProspect> = {}): SnapshotProspect => ({
  id: crypto.randomUUID(),
  name: `Arrêt ${String(i).padStart(2, "0")}`,
  type: "bar",
  address: "Rue du Midi",
  // Spread along a line so the nearest-next order is known: i = 1 is nearest.
  lat: 50.84 + i * 0.001,
  lng: 4.35,
  ...over,
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderStart(snapshot: SnapshotProspect[], adminOnline = false, from = "/tournee") {
  return render(
    <MemoryRouter initialEntries={[from]}>
      <StartScreen snapshot={snapshot} adminOnline={adminOnline} />
      <Where />
    </MemoryRouter>,
  );
}

const swipe = () => screen.getByRole("button", { name: copy.start.swipeName });

/** happy-dom lays nothing out: give the track the 358px the design is drawn on. */
function sizeTrack() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 358,
    height: 64,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 358,
    bottom: 64,
    toJSON: () => ({}),
  });
}

beforeEach(async () => {
  syncNow.mockClear();
  sync.confirmed = true;
  await Promise.all([fieldDb.outboxTournees.clear(), fieldDb.outboxStops.clear()]);
});

afterEach(() => {
  vi.restoreAllMocks();
  setReadingIdentity(null);
  dropReading();
});

describe("the preview", () => {
  it("shows the count, the first seven by name and the rest as a line", () => {
    // Reverse order in, so the name sort is what orders the preview.
    const snapshot = Array.from({ length: 20 }, (_, i) => stop(20 - i));
    renderStart(snapshot);

    expect(screen.getByRole("heading", { name: copy.today.title })).toBeTruthy();
    expect(screen.getByText("20 arrêts")).toBeTruthy();
    expect(screen.getByText(copy.start.explainer)).toBeTruthy();
    const names = screen.getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);
    expect(names).toEqual(
      Array.from({ length: 7 }, (_, i) => `Arrêt ${String(i + 1).padStart(2, "0")}`),
    );
    expect(screen.getByText("et 13 autres arrêts")).toBeTruthy();
  });

  it("says « et 1 autre arrêt » for one more, and nothing for seven or fewer", () => {
    const { unmount } = renderStart(Array.from({ length: 8 }, (_, i) => stop(i + 1)));
    expect(screen.getByText("et 1 autre arrêt")).toBeTruthy();
    unmount();

    renderStart(Array.from({ length: 7 }, (_, i) => stop(i + 1)));
    expect(screen.queryByText(/autre/)).toBeNull();
  });

  it("offers an admin the way back, and an agent nothing", () => {
    const { unmount } = renderStart([stop(1)], true);
    expect(screen.getByRole("link", { name: copy.nav.tabs.dashboard }).getAttribute("href")).toBe(
      "/admin",
    );
    unmount();
    renderStart([stop(1)], false);
    expect(screen.queryByRole("link", { name: copy.nav.tabs.dashboard })).toBeNull();
  });
});

describe("without a position", () => {
  it("is aria-disabled, says why, offers « Réessayer » and starts nothing", async () => {
    renderStart([stop(1)]);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: copy.today.retryPosition })).toBeTruthy(),
    );
    expect(swipe().getAttribute("aria-disabled")).toBe("true");
    expect(swipe().textContent).toContain(copy.start.waiting);

    fireEvent.click(swipe());
    expect(await fieldDb.outboxTournees.count()).toBe(0);
  });
});

describe("with a position", () => {
  beforeEach(() => setGeolocation(HERE));

  it("starts at once on a keyboard activation: one tournée, stops numbered nearest-next, Tournée opens", async () => {
    const snapshot = [stop(3), stop(1), stop(2)];
    // From a deep link, so the pathname only becomes /tournee through `navigate`.
    renderStart(snapshot, false, "/tournee/carte");
    expect(screen.getByTestId("where").textContent).toBe("/tournee/carte");
    await waitFor(() => expect(swipe().getAttribute("aria-disabled")).toBeNull());

    swipe().focus();
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(syncNow).toHaveBeenCalled());
    expect(screen.getByTestId("where").textContent).toBe("/tournee");

    const tournees = await fieldDb.outboxTournees.toArray();
    expect(tournees).toHaveLength(1);
    expect(tournees[0]).toMatchObject({ writtenBy: "agent@example.com" });
    const stops = (await fieldDb.outboxStops.toArray()).sort((a, b) => a.number - b.number);
    expect(stops.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(stops.map((s) => s.prospectId)).toEqual(
      [snapshot[1], snapshot[2], snapshot[0]].map((s) => s?.id),
    );
    expect(stops.every((s) => s.tourneeId === tournees[0]?.id)).toBe(true);
  });

  it("stamps the rows confirmed when the identity is live, and unconfirmed when it came from the cache", async () => {
    renderStart([stop(1), stop(2)]);
    await waitFor(() => expect(swipe().getAttribute("aria-disabled")).toBeNull());
    fireEvent.click(swipe(), { detail: 0 });
    await waitFor(() => expect(syncNow).toHaveBeenCalled());

    for (const row of [
      ...(await fieldDb.outboxTournees.toArray()),
      ...(await fieldDb.outboxStops.toArray()),
    ]) {
      expect(row).not.toHaveProperty("unconfirmed");
    }
  });

  it("stamps the tournée and every stop unconfirmed on a cache-sourced identity (docs/backlog/013)", async () => {
    sync.confirmed = false;
    renderStart([stop(1), stop(2)]);
    await waitFor(() => expect(swipe().getAttribute("aria-disabled")).toBeNull());
    fireEvent.click(swipe(), { detail: 0 });
    await waitFor(() => expect(syncNow).toHaveBeenCalled());

    const tournees = await fieldDb.outboxTournees.toArray();
    const stops = await fieldDb.outboxStops.toArray();
    expect(tournees).toHaveLength(1);
    expect(stops).toHaveLength(2);
    for (const row of [...tournees, ...stops]) {
      expect(row).toMatchObject({ unconfirmed: true, writtenBy: "agent@example.com" });
    }
  });

  it("starts on Space too", async () => {
    renderStart([stop(1)]);
    await waitFor(() => expect(swipe().getAttribute("aria-disabled")).toBeNull());
    swipe().focus();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(db.fieldDb.outboxTournees.count()).resolves.toBe(1));
  });

  it("starts on a full drag, past three quarters of the track", async () => {
    sizeTrack();
    renderStart([stop(2), stop(1)]);
    await waitFor(() => expect(swipe().getAttribute("aria-disabled")).toBeNull());

    fireEvent.pointerDown(swipe(), {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 30,
    });
    fireEvent.pointerMove(swipe(), { pointerId: 1, clientX: 150, clientY: 31 });
    fireEvent.pointerMove(swipe(), { pointerId: 1, clientX: 300, clientY: 31 });
    fireEvent.pointerUp(swipe(), { pointerId: 1, clientX: 300, clientY: 31 });

    await waitFor(() => expect(syncNow).toHaveBeenCalled());
    expect(await fieldDb.outboxTournees.count()).toBe(1);
    expect(await fieldDb.outboxStops.count()).toBe(2);
  });

  it("snaps back from a short drag and writes nothing", async () => {
    sizeTrack();
    renderStart([stop(1)]);
    await waitFor(() => expect(swipe().getAttribute("aria-disabled")).toBeNull());

    fireEvent.pointerDown(swipe(), {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 30,
    });
    fireEvent.pointerMove(swipe(), { pointerId: 1, clientX: 120, clientY: 31 });
    fireEvent.pointerUp(swipe(), { pointerId: 1, clientX: 120, clientY: 31 });

    expect(await fieldDb.outboxTournees.count()).toBe(0);
    expect(syncNow).not.toHaveBeenCalled();
  });

  it("does not start on a pointer tap, which only nudges", async () => {
    renderStart([stop(1)]);
    await waitFor(() => expect(swipe().getAttribute("aria-disabled")).toBeNull());

    await userEvent.click(swipe());

    expect(await fieldDb.outboxTournees.count()).toBe(0);
  });

  it("lets a vertical start scroll: nothing moves, nothing starts", async () => {
    sizeTrack();
    renderStart([stop(1)]);
    await waitFor(() => expect(swipe().getAttribute("aria-disabled")).toBeNull());

    fireEvent.pointerDown(swipe(), {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(swipe(), { pointerId: 1, clientX: 12, clientY: 80 });
    fireEvent.pointerMove(swipe(), { pointerId: 1, clientX: 330, clientY: 82 });
    fireEvent.pointerUp(swipe(), { pointerId: 1, clientX: 330, clientY: 82 });

    expect(await fieldDb.outboxTournees.count()).toBe(0);
  });

  it("writes once however many times it is activated while writing", async () => {
    renderStart([stop(1), stop(2)]);
    await waitFor(() => expect(swipe().getAttribute("aria-disabled")).toBeNull());

    fireEvent.click(swipe(), { detail: 0 });
    fireEvent.click(swipe(), { detail: 0 });
    fireEvent.click(swipe(), { detail: 0 });

    await waitFor(() => expect(syncNow).toHaveBeenCalled());
    expect(await fieldDb.outboxTournees.count()).toBe(1);
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it("shows « Démarrage… » while the write runs", async () => {
    let release: () => void = () => {};
    vi.spyOn(db, "startTournee").mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    renderStart([stop(1)]);
    await waitFor(() => expect(swipe().getAttribute("aria-disabled")).toBeNull());

    fireEvent.click(swipe(), { detail: 0 });

    await waitFor(() => expect(swipe().textContent).toContain(copy.start.starting));
    expect(swipe().getAttribute("aria-disabled")).toBe("true");
    await act(async () => release());
  });

  it("puts the thumb back and shows the storage error when the write fails, then lets the agent retry", async () => {
    const failing = vi.spyOn(db, "startTournee").mockRejectedValueOnce(new Error("QuotaExceeded"));
    renderStart([stop(1)]);
    await waitFor(() => expect(swipe().getAttribute("aria-disabled")).toBeNull());

    fireEvent.click(swipe(), { detail: 0 });

    expect((await screen.findByRole("alert")).textContent).toBe(copy.start.storageError);
    expect(swipe().getAttribute("aria-disabled")).toBeNull();
    expect(syncNow).not.toHaveBeenCalled();

    failing.mockRestore();
    fireEvent.click(swipe(), { detail: 0 });
    await waitFor(() => expect(syncNow).toHaveBeenCalled());
  });
});
