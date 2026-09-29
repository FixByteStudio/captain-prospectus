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
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { applyUpdateNow } from "../pwa";
import { confirmOutbox, fieldDb, outboxCounts } from "./db";
import type { WriteStamp } from "./outbox-stamp";
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
   * network" and are counted apart from `pending`.
   */
  heldBack: number;
  /** The email every new outbox row is stamped with (`writtenBy`). */
  identity: string;
  lastSyncAt: number | null;
  /** Run now. Awaited by the visit form so a save is followed by a push. */
  syncNow: () => Promise<void>;
  /**
   * What a new outbox row should carry (backlog 013): `writtenBy: identity`,
   * plus `unconfirmed: true` while `confirmed` is false. `VisitScreen` and
   * `AddProspectScreen` spread this onto every row and log entry they write,
   * instead of each re-deriving `identityFromCache` through a second prop
   * chain.
   */
  stamp: WriteStamp;
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
  /**
   * False while `identity` is cache-sourced (`!identityFromCache` in
   * `App.tsx`) — backlog 013. `syncNow` re-asks `/api/me` instead of
   * `runSync` for as long as this is false, so nothing leaves the phone
   * under an identity the Access cookie may not match.
   */
  confirmed: boolean;
  /** Re-runs `App.tsx`'s identity effect (the `recheck` counter) — the one
   * `/api/me` fetch path, so a heartbeat re-check and an `online` re-check
   * cannot both fire at once. */
  recheckIdentity: () => void;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<SyncStatus>("ok");
  const [running, setRunning] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  /**
   * Bumped every time `syncNow` re-asks the identity instead of syncing, so
   * the heartbeat effect below reruns and reschedules on backoff even though
   * `status` itself never changes while unconfirmed (`runSync` is never
   * called, so nothing would otherwise tell the timer a pass happened).
   */
  const [tick, setTick] = useState(0);

  /** The status this provider reports. Derived, never stored (backlog 013
   * Design Notes): confirmation shows the last real status at once instead
   * of a stale "unconfirmed" strip sitting in state one render too long. */
  const reportedStatus: SyncStatus = confirmed ? status : "unconfirmed";

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

  // A failure streak built up while unconfirmed (one bump per re-check) is
  // not evidence against the confirmed session that follows — carrying it
  // over would back off the first real sync failure as if it were the
  // Nth.
  useEffect(() => {
    if (confirmed) failures.current = 0;
  }, [confirmed]);

  const syncNow = useCallback(async () => {
    // Single-flight. The triggers overlap by design — saving a visit while the
    // 60 s heartbeat fires is normal — and two concurrent runs would each build
    // a payload from the same outbox rows. (The unconfirmed branch below does
    // not need this for `/api/me`: that fetch's own single-flight is
    // `App.tsx`'s `checking` ref, since `recheckIdentity` returns before this
    // guard would ever see two calls overlap.)
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true);

    try {
      if (!confirmed) {
        // Nothing leaves the phone under an identity the Access cookie may
        // not match. Re-ask instead of syncing; the failure count and tick
        // make the heartbeat below back off exactly as it would for "error".
        recheckIdentity();
        failures.current += 1;
        setTick((n) => n + 1);
        return;
      }

      // A visit can be saved between App's own `confirmOutbox` commit and the
      // re-render that flips `confirmed` true, landing here still flagged
      // with no live `/api/me` left to run this session — this is the second
      // place that must confirm it, or it would sit unsent until the app is
      // closed and reopened.
      await confirmOutbox(fieldDb, identity);

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
    }
    // `confirmed` is a dep so a confirmation flips this callback's identity,
    // which reruns the app-start effect below and fires an immediate sync —
    // the one moment a freshly confirmed outbox should not wait for the next
    // trigger.
  }, [identity, confirmed, recheckIdentity]);

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

    const delay = nextDelayMs(reportedStatus, failures.current);
    timer.current = setTimeout(() => void syncNow(), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // `running` is in the deps so the next tick is scheduled from the end of a
    // run, not from its start — otherwise a slow sync would queue the next one
    // immediately behind it. `tick` is in the deps because `reportedStatus`
    // alone would not change across two unconfirmed passes (`status` never
    // moves while `confirmed` is false), so nothing else would reschedule the
    // timer after `syncNow` bumps the failure count.
  }, [reportedStatus, running, syncNow, tick]);

  // A backgrounded tab syncing every 60 s spends request quota on nobody
  // looking. Coming back to the foreground is itself a trigger.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) void syncNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [syncNow]);

  // Memoized: the two writers list `stamp` in their `useCallback` deps.
  const stamp = useMemo<WriteStamp>(
    () => (confirmed ? { writtenBy: identity } : { writtenBy: identity, unconfirmed: true }),
    [confirmed, identity],
  );

  return (
    <SyncContext
      value={{
        status: reportedStatus,
        running,
        pending,
        heldBack,
        identity,
        lastSyncAt,
        syncNow,
        stamp,
      }}
    >
      {children}
    </SyncContext>
  );
}
