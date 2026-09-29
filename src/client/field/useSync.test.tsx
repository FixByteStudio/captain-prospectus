/**
 * `SyncProvider`'s own gate on an unconfirmed identity (docs/backlog/013).
 *
 * `sync.test.ts` covers what `runSync` does with an `unconfirmed` outbox row;
 * this file covers the one thing only the provider itself can be responsible
 * for — that it never calls `runSync` at all while `confirmed` is false, and
 * that every trigger, the 60 s heartbeat included, asks `recheckIdentity`
 * instead. `App.tsx` owns what `recheckIdentity` actually does (its own
 * tests), so it is a bare spy here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { fieldDb, type StoredVisit } from "./db";
import { SyncProvider, useSyncState } from "./useSync";

function Probe() {
  const { status } = useSyncState();
  return <p data-testid="status">{status}</p>;
}

const okBody = {
  serverTime: 1_700_000_100_000,
  accepted: { prospects: [], visits: [] },
  idMap: {},
  prospects: [],
  script: null,
};

const visit = (over: Partial<StoredVisit> = {}): StoredVisit => ({
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

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await Promise.all([fieldDb.outboxVisits.clear(), fieldDb.outboxProspects.clear()]);
});

describe("SyncProvider — unconfirmed identity", () => {
  it("never calls runSync while unconfirmed, and reports the unconfirmed status", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const recheckIdentity = vi.fn();

    render(
      <SyncProvider identity="a@example.com" confirmed={false} recheckIdentity={recheckIdentity}>
        <Probe />
      </SyncProvider>,
    );

    // Trigger 1: app start.
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(recheckIdentity).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status").textContent).toBe("unconfirmed");
  });

  /**
   * A repeat "unconfirmed" tick changes neither `status` (already
   * `"unconfirmed"`) nor `running` (settles back to `false` either way), so a
   * heartbeat effect keyed only on those two — the shape every other status
   * already used — reschedules once and then never again: exactly the
   * "5xx re-checks once and never again" bug this task exists to close,
   * arrived at from the other side. Three consecutive backoff steps (5 s,
   * 10 s, 20 s) is what actually catches a fix that only gets tick 2 right.
   */
  it("the heartbeat keeps re-asking /api/me on every backoff step, not just the first", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const recheckIdentity = vi.fn();
    vi.useFakeTimers();

    render(
      <SyncProvider identity="a@example.com" confirmed={false} recheckIdentity={recheckIdentity}>
        <Probe />
      </SyncProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(recheckIdentity).toHaveBeenCalledTimes(1);

    // `nextDelayMs("unconfirmed", n)` backs off exactly like "error": 5 s, 10 s, 20 s.
    for (const [tick, delay] of [
      [2, 5_000],
      [3, 10_000],
      [4, 20_000],
    ] as const) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay);
      });
      expect(recheckIdentity).toHaveBeenCalledTimes(tick);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reaches runSync as soon as confirmed flips true, without waiting for the heartbeat", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(okBody), { status: 200 }));
    const recheckIdentity = vi.fn();

    const { rerender } = render(
      <SyncProvider identity="a@example.com" confirmed={false} recheckIdentity={recheckIdentity}>
        <Probe />
      </SyncProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    rerender(
      <SyncProvider identity="a@example.com" confirmed={true} recheckIdentity={recheckIdentity}>
        <Probe />
      </SyncProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ok"));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  /**
   * `App.tsx` runs `confirmOutbox` itself before flipping this prop, but a
   * row saved from a render that still read `confirmed=false` — committed
   * after App's own pass finished — would otherwise never clear its flag.
   * This provider-owned pass, keyed on `confirmed` turning true, is the
   * backstop for exactly that row.
   */
  it("confirms a leftover unconfirmed row itself once `confirmed` flips true", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(okBody), { status: 200 }),
    );
    const identity = "a@example.com";
    const stray = visit({ writtenBy: identity, unconfirmed: true });
    await fieldDb.outboxVisits.add(stray);

    const { rerender } = render(
      <SyncProvider identity={identity} confirmed={false} recheckIdentity={vi.fn()}>
        <Probe />
      </SyncProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    rerender(
      <SyncProvider identity={identity} confirmed={true} recheckIdentity={vi.fn()}>
        <Probe />
      </SyncProvider>,
    );

    await waitFor(async () => {
      expect((await fieldDb.outboxVisits.get(stray.id))?.unconfirmed).toBeUndefined();
    });
    expect(await fieldDb.outboxVisits.get(stray.id)).toMatchObject({ writtenBy: identity });
  });
});
