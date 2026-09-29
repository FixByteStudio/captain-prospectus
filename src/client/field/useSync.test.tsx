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
import { fieldDb } from "./db";
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

  it("the heartbeat keeps re-asking /api/me rather than giving up after one try", async () => {
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

    // `nextDelayMs("unconfirmed", 1)` backs off exactly like "error": 5 s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(recheckIdentity.mock.calls.length).toBeGreaterThanOrEqual(2);
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
});
