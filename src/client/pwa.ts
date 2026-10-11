/**
 * Service worker registration (ADR-0004).
 *
 * `registerType: "prompt"` in `vite.config.ts`: a new build never activates
 * behind the agent's back, because an agent halfway through a round should
 * decide when to take it. The one exception is a 426, forced by
 * `applyUpdateNow` (docs/domains/field-operations.md, "Versioning").
 */
import { useRegisterSW } from "virtual:pwa-register/react";

export type PwaState = {
  /** A new build is waiting. The agent is asked, not interrupted. */
  needRefresh: boolean;
  /** Everything needed to run with no network is cached. */
  offlineReady: boolean;
  /** Activate the waiting worker and reload. */
  update: () => void;
  /** Dismiss the prompt without updating; it returns on the next check. */
  dismiss: () => void;
};

/**
 * Module scope, because the one caller that needs this is the sync engine,
 * which is not a component and must not depend on one being mounted.
 */
let registration: ServiceWorkerRegistration | undefined;
let updateServiceWorkerFn: ((reload?: boolean) => Promise<void>) | undefined;
let forced = false;

/**
 * Re-check first, because a phone old enough to be refused may not have seen
 * the new build yet. In "prompt" mode `updateServiceWorker` only posts
 * `skipWaiting` to a worker already waiting, so with nothing to take this is a
 * no-op, not a reload loop. At most once per page load: after that the page has
 * reloaded onto the new build, or there is none and re-asking spends requests.
 */
export async function applyUpdateNow(): Promise<void> {
  if (forced) return;
  // Nothing has registered yet, so there is nothing to force. Returning
  // without burning the one attempt matters: a 426 answered before the
  // registration landed would otherwise disable this for the whole page load.
  if (!updateServiceWorkerFn) return;
  forced = true;

  try {
    await registration?.update();
    await updateServiceWorkerFn?.();
  } catch {
    // An unreachable or refused update is the same situation as before it was
    // attempted: the outbox waits on disk, and the agent keeps working.
  }
}

export function usePwa(): PwaState {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_swUrl, r) => {
      registration = r;
    },
  });

  // Assigned on every render rather than in an effect, so `applyUpdateNow` is
  // usable from the first sync — which runs in an effect of its own, and would
  // otherwise race this one. The value is the same on every render.
  updateServiceWorkerFn = updateServiceWorker;

  return {
    needRefresh,
    offlineReady,
    update: () => void updateServiceWorker(true),
    dismiss: () => setNeedRefresh(false),
  };
}
