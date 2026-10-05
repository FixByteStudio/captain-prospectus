/**
 * One position reading, on request.
 *
 * `getCurrentPosition`, never `watchPosition`: continuous GPS tracking of
 * agents is an explicit non-goal in vision.md. This hook is the whole of the
 * app's access to it. Each reading is also kept in module memory, so the next
 * sync can offer the latest one of the day to the admin's round view; sync
 * itself never reads the position (ADR-0028, `last-reading.ts`).
 *
 * Every failure is survivable. A denied permission orders the list by nothing
 * and labels distances « Position inconnue »; it never blocks a visit.
 */
import { useCallback, useEffect, useState } from "react";
import type { Point } from "../../shared/geo";
import { rememberReading } from "./last-reading";

export type PositionState = {
  point: Point | null;
  /** True while a reading is outstanding. */
  locating: boolean;
  /** Set once a reading has failed; the screen degrades rather than retries. */
  denied: boolean;
  /** Ask again — the agent has moved, or granted permission since. */
  refresh: () => void;
};

const OPTIONS: PositionOptions = {
  // A pavement fix, not a survey. Ten seconds is longer than an agent will
  // wait, and a two-minute-old reading is fine for ordering doors by distance.
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 120_000,
};

export function useAgentPosition(): PositionState {
  const [point, setPoint] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setDenied(true);
      return;
    }

    let cancelled = false;
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // The fix was taken whether or not this screen is still mounted, and
        // `timestamp` is when the device took it, not when we got here.
        rememberReading({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: pos.timestamp,
        });
        if (cancelled) return;
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDenied(false);
        setLocating(false);
      },
      () => {
        if (cancelled) return;
        // Denied, unavailable and timed out are one case here: we have no
        // position and the screen carries on without one.
        setDenied(true);
        setLocating(false);
      },
      OPTIONS,
    );

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { point, locating, denied, refresh };
}
