/**
 * One position reading, on request.
 *
 * `getCurrentPosition`, never `watchPosition`: continuous GPS tracking of
 * agents is an explicit non-goal in vision.md. This hook is the whole of the
 * app's access to it. Each reading is also kept in module memory, so the next
 * sync can offer the latest one of the day to the admin's round view; sync
 * itself never reads the position (ADR-0028, `last-reading.ts`).
 *
 * Once the day has started every failure is survivable: a denied permission
 * labels distances « Position inconnue », changes no stop's number or order, and
 * never blocks a visit. Before the swipe the location gate holds instead — it
 * takes fresh readings through this hook until one is precise enough
 * (`useLocationGate`, ADR-0036).
 */
import { useCallback, useEffect, useState } from "react";
import type { Point } from "../../shared/geo";
import { rememberReading } from "./last-reading";

export type PositionState = {
  point: Point | null;
  /** True while a reading is outstanding. */
  locating: boolean;
  /** Metres of uncertainty of the latest successful reading. */
  accuracy: number | null;
  /** Set once a reading has failed (any code); the screen degrades rather than retries. */
  denied: boolean;
  /** The failure was the permission itself (error code 1), not a lost fix. */
  refused: boolean;
  /** Ask again — the agent has moved, or granted permission since. */
  refresh: () => void;
};

export type AgentPositionOptions = {
  /** Take no reading on mount: the first one is `refresh()`. */
  lazy?: boolean;
  /** `maximumAge: 0`, so a cached coarse fix cannot come back. */
  fresh?: boolean;
  highAccuracy?: boolean;
};

/** PERMISSION_DENIED in `GeolocationPositionError`. */
const PERMISSION_DENIED = 1;

export function useAgentPosition({
  lazy = false,
  fresh = false,
  highAccuracy = false,
}: AgentPositionOptions = {}): PositionState {
  const [point, setPoint] = useState<Point | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [refused, setRefused] = useState(false);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (lazy && nonce === 0) return;
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
        setAccuracy(pos.coords.accuracy);
        setDenied(false);
        setRefused(false);
        setLocating(false);
      },
      (error) => {
        if (cancelled) return;
        // Denied, unavailable and timed out are one `denied` here: we have no
        // position and the screen carries on without one. Only the location
        // gate tells a refusal apart, because only a refusal never repeats.
        setDenied(true);
        setRefused(error.code === PERMISSION_DENIED);
        setLocating(false);
      },
      {
        // A pavement fix, not a survey. Ten seconds is longer than an agent
        // will wait, and a two-minute-old reading is fine for the distances
        // a row shows. The gate wants a fresh one: the cache would hand back
        // the same coarse fix on every repeat.
        enableHighAccuracy: highAccuracy,
        timeout: 10_000,
        maximumAge: fresh ? 0 : 120_000,
      },
    );

    return () => {
      cancelled = true;
    };
  }, [nonce, lazy, fresh, highAccuracy]);

  return { point, accuracy, locating, denied, refused, refresh };
}
