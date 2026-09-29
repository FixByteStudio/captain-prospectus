/**
 * `SyncProvider`'s unconfirmed branch (backlog 013): a cache-sourced identity
 * must send nothing and re-ask `/api/me` instead, on every trigger, until a
 * live answer confirms it. Everything else about the four triggers already
 * has coverage through `sync.ts`/`sync-schedule.ts`'s own tests; this file
 * only proves the wiring `confirmed`/`recheckIdentity` add.
 */
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncResponse } from "../../shared/schemas";
import { fieldDb } from "./db";
import { SyncProvider, useSyncState } from "./useSync";

const AGENT = "agent@example.com";

const okResponse = (): SyncResponse => ({
  serverTime: 1_700_000_100_000,
  accepted: { prospects: [], visits: [] },
  idMap: {},
  prospects: [],
  script: null,
});

function renderSync(props: { confirmed: boolean; recheckIdentity: () => void }) {
  return renderHook(() => useSyncState(), {
    wrapper: ({ children }) => (
      <SyncProvider
        identity={AGENT}
        confirmed={props.confirmed}
        recheckIdentity={props.recheckIdentity}
      >
        {children}
      </SyncProvider>
    ),
  });
}

beforeEach(async () => {
  await fieldDb.outboxVisits.clear();
  await fieldDb.outboxProspects.clear();
  await fieldDb.sentVisits.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SyncProvider — unconfirmed", () => {
  it("sends nothing and re-asks the identity instead, reporting status unconfirmed", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const recheckIdentity = vi.fn();

    const { result } = renderSync({ confirmed: false, recheckIdentity });

    await waitFor(() => expect(result.current.status).toBe("unconfirmed"));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(recheckIdentity).toHaveBeenCalled();
  });

  it("re-asks the identity on the next heartbeat after a failed /api/me, still sending nothing", async () => {
    vi.useFakeTimers();
    try {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      // A no-op stands in for a `/api/me` that answered 500: `App.tsx` keeps
      // the cached identity, so `confirmed` stays false.
      const recheckIdentity = vi.fn();

      renderSync({ confirmed: false, recheckIdentity });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const afterStart = recheckIdentity.mock.calls.length;
      expect(afterStart).toBeGreaterThanOrEqual(1);

      // Several backoff windows, not just one: proves the timer keeps
      // rescheduling itself on every pass, not only reacting once to the
      // first failure. One `act` per window, so React gets to commit the
      // `tick` bump and re-run the heartbeat effect with the grown failure
      // count between advances, exactly as it would across real renders.
      for (let window = 0; window < 5; window++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5 * 60_000);
        });
      }
      expect(recheckIdentity.mock.calls.length).toBeGreaterThanOrEqual(afterStart + 2);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stamps a new row's identity with unconfirmed while not confirmed", () => {
    const { result } = renderSync({ confirmed: false, recheckIdentity: vi.fn() });
    expect(result.current.stamp).toEqual({ writtenBy: AGENT, unconfirmed: true });
  });

  it("stamps without the flag once confirmed, and syncs immediately", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(okResponse()), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    let latest: ReturnType<typeof useSyncState> | undefined;
    function Probe() {
      latest = useSyncState();
      return null;
    }
    function Harness({ confirmed }: { confirmed: boolean }) {
      return (
        <SyncProvider identity={AGENT} confirmed={confirmed} recheckIdentity={() => {}}>
          <Probe />
        </SyncProvider>
      );
    }

    const { rerender } = render(<Harness confirmed={false} />);
    expect(latest?.stamp.unconfirmed).toBe(true);

    const callsBefore = fetchSpy.mock.calls.length;
    await act(async () => {
      rerender(<Harness confirmed={true} />);
      await Promise.resolve();
    });

    await waitFor(() => expect(latest?.stamp).toEqual({ writtenBy: AGENT }));
    // Confirmation is in `syncNow`'s deps, so the app-start effect reruns and
    // fires an immediate sync rather than waiting for the next trigger.
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("sends a row left unconfirmed from before this session's confirmation, not just newly-written ones", async () => {
    // A visit saved between App's own `confirmOutbox` commit and the
    // re-render that flips `confirmed` true lands here still flagged, with no
    // more live `/api/me` left to run this session — `syncNow`'s own
    // `confirmOutbox` call in the confirmed path is what catches it.
    const rowId = crypto.randomUUID();
    await fieldDb.outboxVisits.add({
      id: rowId,
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
      writtenBy: AGENT,
      unconfirmed: true,
    });

    let sentIds: string[] = [];
    const fetchSpy = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { visits: { id: string }[] };
      sentIds = body.visits.map((v) => v.id);
      return new Response(
        JSON.stringify({ ...okResponse(), accepted: { prospects: [], visits: sentIds } }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    renderSync({ confirmed: true, recheckIdentity: vi.fn() });

    await waitFor(() => expect(sentIds).toEqual([rowId]));
    await waitFor(async () => expect(await fieldDb.outboxVisits.count()).toBe(0));
  });
});
