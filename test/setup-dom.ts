// Dexie needs an IndexedDB implementation outside the browser (setup-unit.ts).
import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { currentGeolocation, resetGeolocation } from "./geolocation";

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
        if (fix === "denied") {
          fail?.({ code: 1, message: "denied" } as GeolocationPositionError);
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

// Vitest's `globals` are off, so Testing Library's auto-cleanup never registers
// itself. Without this a mounted tree survives into the next test and
// `getByRole` finds two of everything.
afterEach(() => {
  cleanup();
  resetGeolocation();
});
