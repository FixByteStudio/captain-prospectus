// Dexie needs an IndexedDB implementation outside the browser (setup-unit.ts).
import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { currentGeolocation, currentGeolocationPermission, resetGeolocation } from "./geolocation";

/**
 * happy-dom declares `navigator.geolocation` but leaves it `null`, so
 * `useAgentPosition`'s `"geolocation" in navigator` guard passes and the call
 * that follows throws — in a real browser the property is either absent or a
 * working object. This installs one whose answer a test picks with
 * `setGeolocation` (test/geolocation.ts), refused unless it does.
 *
 * It answers on a microtask, as a browser answers after the call returns, so
 * the hook's `locating` state is observable. A microtask rather than a timer,
 * so a test on fake timers still sees the answer land.
 */
Object.defineProperty(navigator, "geolocation", {
  configurable: true,
  value: {
    getCurrentPosition: (ok: PositionCallback, fail?: PositionErrorCallback) => {
      const fix = currentGeolocation();
      queueMicrotask(() => {
        if (fix === "denied" || fix === "unavailable" || fix === "timeout") {
          const code = fix === "denied" ? 1 : fix === "unavailable" ? 2 : 3;
          fail?.({ code, message: fix } as GeolocationPositionError);
          return;
        }
        ok({
          coords: { latitude: fix.lat, longitude: fix.lng, accuracy: fix.accuracy ?? 20 },
          timestamp: fix.timestamp ?? Date.now(),
        } as GeolocationPosition);
      });
    },
    watchPosition: () => 0,
    clearWatch: () => {},
  },
});

/**
 * The Permissions API, as far as the location gate reads it: absent unless a
 * test calls `setGeolocationPermission`, then a `query` that answers it. A
 * getter, so the answer is read at call time like the fix is.
 */
Object.defineProperty(navigator, "permissions", {
  configurable: true,
  get: () => {
    const state = currentGeolocationPermission();
    return state === null ? undefined : { query: async () => ({ state }) };
  },
});

// Vitest's `globals` are off, so Testing Library's auto-cleanup never registers
// itself. Without this a mounted tree survives into the next test and
// `getByRole` finds two of everything.
afterEach(() => {
  cleanup();
  resetGeolocation();
});
