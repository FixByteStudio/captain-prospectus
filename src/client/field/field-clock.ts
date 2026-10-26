/**
 * The field screens' one clock for "today" — ADR-0036 › The gates, docs/design.md › Midnight.
 *
 * The gate, Tournée, Carte, Carnet and the start screen all read the Brussels
 * day through `useFieldNow`, so they turn over together at midnight and never
 * disagree about which day it is. A module-level store, not a hook's own timer:
 * one `setTimeout` for the whole app, however many screens read it.
 */
import { useState, useSyncExternalStore } from "react";
import { brusselsMidnightDaysFromNow } from "../../shared/period";
import { useSyncState } from "./useSync";

/** `Date.now()` when the last Brussels midnight was crossed while subscribed; 0 before. */
let tick = 0;
/** The Brussels midnight the timer is set for; 0 while nobody subscribes. */
let armedFor = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function arm(): void {
  clearTimeout(timer);
  armedFor = brusselsMidnightDaysFromNow(Date.now(), 1);
  timer = setTimeout(check, Math.max(0, armedFor - Date.now()));
}

/** Crosses the midnight the timer waits for, if the clock has reached it, and arms the next. */
function check(): void {
  if (armedFor === 0) return;
  if (Date.now() >= armedFor) {
    tick = Date.now();
    arm();
    for (const listener of listeners) listener();
    return;
  }
  // A timer that fired early, or a visibility check before midnight: wait again.
  arm();
}

/**
 * A sleeping phone can hold the timer back past midnight, and the page may be
 * visible long before it fires, so becoming visible asks the clock again.
 */
function onVisibilityChange(): void {
  if (document.visibilityState === "visible") check();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    arm();
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    clearTimeout(timer);
    timer = undefined;
    armedFor = 0;
    tick = 0;
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

const getSnapshot = () => tick;
const getServerSnapshot = () => 0;

/**
 * "Now", for deciding which Brussels day is today.
 *
 * Deliberately stale, never read during render (an impure call): the latest of
 * the last successful sync of this session, the moment these screens mounted
 * and the last Brussels midnight the phone crossed while mounted, all on the
 * phone's clock like the swipe's `startedAt`. The mount time matters when the
 * frame remounts after midnight with yesterday's sync still the last one.
 * `meta.lastSyncAt` is the server's clock and only answers "has a pull ever
 * succeeded?". The tick is a timestamp, so a sync after midnight cannot pull
 * "now" back to yesterday.
 */
export function useFieldNow(): number {
  const { lastSyncAt } = useSyncState();
  const [openedAt] = useState(() => Date.now());
  const crossed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return Math.max(lastSyncAt ?? 0, openedAt, crossed);
}

/** The store itself, exported for its test: `useFieldNow` is the only reader in the app. */
export { subscribe as subscribeFieldClock, getSnapshot as fieldClockTick };
