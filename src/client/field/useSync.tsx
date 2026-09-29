/**
 * The four sync triggers — docs/domains/field-operations.md#triggers:
 * app start, the `online` event, immediately after saving a visit, and every
 * 60 s while the app is open.
 *
 * The rules about *when* live in `sync-schedule.ts` so they can be tested
 * without a browser. This file owns only the wiring: timers, listeners, and a
 * single-flight guard.
 *
 * NOT TanStack Query, deliberately (ADR-0013 decision 3). Dexie is the source
 * of truth on this side and the sync engine owns every write to it; a second
 * cache over the outbox is how visits get lost.
 */
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { applyUpdateNow } from "../pwa";
import { confirmOutbox, fieldDb, outboxCounts } from "./db";
import { runSync, type SyncStatus } from "./sync";
import { nextDelayMs, nextFailureCount, shouldDrain } from "./sync-schedule";

export type SyncState = {
  status: SyncStatus;
  /** True only while a round trip is in flight. */
  running: boolean;
  /** This identity's local writes still waiting for the server to list them in `accepted`. */
  pending: number;
  /**
   * Local writes another identity made on this device. Never sent while this
   * one is signed in (docs/backlog/005), so they are not "waiting on the
   * network" and are counted apart from `pending`. A row this identity wrote
   * while still `unconfirmed` (docs/backlog/013) is not held back — it is
   * this identity's own not-yet-sendable work, and `pending` counts it (the
   * `"unconfirmed"` status is what says why it has not gone out).
   */
  heldBack: number;
  /** The email every new outbox row is stamped with (`writtenBy`). */
  identity: string;
  /**
   * False while `identity` came from the cache rather than a live `/api/me`
   * (docs/backlog/013): the Access cookie the next request carries may not
   * match it. `queueVisit` and the add-prospect write read this to stamp a
   * row `unconfirmed`.
   */
  confirmed: boolean;
  lastSyncAt: number | null;
  /** Run now. Awaited by the visit form so a save is followed by a push. */
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncState | null>(null);

const NO_OUTBOX = { pending: 0, heldBack: 0 };

/** Read the sync state. Throws outside the provider rather than faking a value. */
export function useSyncState(): SyncState {
  const value = use(SyncContext);
  if (!value) throw new Error("useSyncState must be used inside <SyncProvider>");
  return value;
}

export function SyncProvider({
  identity,
  confirmed,
  recheckIdentity,
  children,
}: {
  identity: string;
  /** False while `identity` is cache-sourced (docs/backlog/013). */
  confirmed: boolean;
  /** Re-asks `/api/me`; what every trigger calls instead of `runSync` while
   * `confirmed` is false. Owned by `App.tsx`, which is the one place that
   * knows how to re-run the identity fetch. */
  recheckIdentity: () => void;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<SyncStatus>("ok");
  const [running, setRunning] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  /**
   * Bumped at the end of every `syncNow` call, purely to force the heartbeat
   * effect below to reschedule. The `unconfirmed` branch returns synchronously
   * (no `await` before it), so a repeat tick's `setStatus("unconfirmed")` and
   * `setRunning(true)`/`(false)` all land in the one React batch that follows
   * — identical to the render from the *previous* tick, since neither value
   * actually changed. Without a value that changes every time regardless,
   * that batch is a no-op render as far as `[status, running]` are concerned,
   * the heartbeat effect never reruns, and no next timer is ever scheduled:
   * exactly the "retries once and never again" bug this state exists to close.
   */
  const [attempt, setAttempt] = useState(0);

  /**
   * Live from Dexie rather than set after a sync, so the count moves the
   * instant the visit form writes a row — an agent who saves a visit offline
   * sees "1 élément en attente" immediately, not 60 seconds later.
   */
  const { pending, heldBack } = useLiveQuery(
    () => outboxCounts(fieldDb, identity),
    [identity],
    NO_OUTBOX,
  );

  // Refs, not state: the loop reads these between awaits and must see the
  // current value, not the one captured when the effect was created.
  const inFlight = useRef(false);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncNow = useCallback(async () => {
    // Single-flight. The triggers overlap by design — saving a visit while the
    // 60 s heartbeat fires is normal — and two concurrent runs would each build
    // a payload from the same outbox rows.
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true);

    try {
      // docs/backlog/013: a cache-sourced identity is unconfirmed, so nothing
      // is sent under a name the Access cookie may not match. Every trigger
      // that would otherwise call `runSync` re-asks `/api/me` instead — the
      // heartbeat included, so a `/api/me` failure keeps retrying rather than
      // giving up after the one re-check the online/offline transition makes.
      if (!confirmed) {
        recheckIdentity();
        failures.current = nextFailureCount("unconfirmed", failures.current);
        setStatus("unconfirmed");
        return;
      }

      let passes = 0;
      let result = await runSync({ db: fieldDb, identity });
      passes += 1;

      // field-operations.md: repeat until the outbox is empty. Bounded, so a
      // server that accepts nothing cannot spin (free-tier-budget.md).
      while (shouldDrain(result, passes)) {
        result = await runSync({ db: fieldDb, identity });
        passes += 1;
      }

      failures.current = nextFailureCount(result.status, failures.current);
      setStatus(result.status);
      if (result.status === "ok") setLastSyncAt(Date.now());

      // 426: the server refuses this build's payload outright, so the outbox
      // stops draining until the phone is on a newer one. field-operations.md
      // makes this the one case that takes an update without asking; backing
      // off politely here just means the visits sit there (INVARIANT 5 keeps
      // them, but keeping them is not sending them).
      if (result.status === "upgrade") void applyUpdateNow();
    } finally {
      inFlight.current = false;
      setRunning(false);
      setAttempt((n) => n + 1);
    }
  }, [identity, confirmed, recheckIdentity]);

  // docs/backlog/013: a defensive backstop, not the primary confirmation path
  // (`App.tsx`'s own `confirmOutbox` call, which runs before `confirmed`
  // flips true here). Closes the one window that call cannot: a row a save
  // wrote `unconfirmed` reading the stale `confirmed=false` from a render
  // that started before App's pass finished, but committed after it — that
  // row's flag survives App's pass and would otherwise never clear. A no-op,
  // idempotently, once nothing is left flagged.
  useEffect(() => {
    if (confirmed) void confirmOutbox(fieldDb, identity);
  }, [confirmed, identity]);

  // Trigger 1: app start.
  useEffect(() => {
    void syncNow();
  }, [syncNow]);

  // Trigger 2: the network came back.
  useEffect(() => {
    const onOnline = () => void syncNow();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncNow]);

  // Trigger 4: the heartbeat. Self-rescheduling rather than setInterval, so the
  // delay can back off after a failure instead of hammering a failing server.
  useEffect(() => {
    if (document.hidden) return;

    const delay = nextDelayMs(status, failures.current);
    timer.current = setTimeout(() => void syncNow(), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // `running` is in the deps so the next tick is scheduled from the end of a
    // run, not from its start — otherwise a slow sync would queue the next one
    // immediately behind it. `attempt` guarantees a reschedule even when a
    // repeat tick changes neither `status` nor `running` (see its own comment).
  }, [status, running, attempt, syncNow]);

  // A backgrounded tab syncing every 60 s spends request quota on nobody
  // looking. Coming back to the foreground is itself a trigger.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) void syncNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [syncNow]);

  return (
    <SyncContext
      value={{ status, running, pending, heldBack, identity, confirmed, lastSyncAt, syncNow }}
    >
      {children}
    </SyncContext>
  );
}
