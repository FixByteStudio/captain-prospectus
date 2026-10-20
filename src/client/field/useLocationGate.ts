/**
 * The location gate's readings — docs/design.md › The location dialog, ADR-0036.
 *
 * Policy on top of `useAgentPosition.ts`, which stays the app's only door to
 * geolocation: fresh one-off readings, begun by the agent's « Activer » or at
 * once when the browser already reports the permission as granted, and repeated
 * while the last one was too coarse and the page is visible. A refusal or a
 * lost fix does not repeat: the browser would not ask again, so repeating would
 * only spin. Coming back from Réglages re-checks the permission instead.
 *
 * The gate ends at the pass, but the position it latched ages: `swipePoint`
 * takes one more fresh reading at the swipe, under the gate's own rule, and
 * falls back to the latched point. It never reopens the gate.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Point } from "../../shared/geo";
import {
  LOCATION_GATE_ACCURACY_M,
  LOCATION_GATE_HIGH_ACCURACY,
  LOCATION_GATE_RETRY_MS,
  LOCATION_GATE_SWIPE_TIMEOUT_MS,
  locationStatus,
  type LocationStatus,
} from "./location-gate";
import { takeReading, useAgentPosition } from "./useAgentPosition";

export type LocationGate = {
  status: LocationStatus;
  /** The reading that passed the gate; null until one does, then fixed. The swipe's fallback. */
  point: Point | null;
  /** Where to number from, now: a fresh reading if it passes the rule, else `point`. Never rejects. */
  swipePoint: () => Promise<Point | null>;
  /** Takes a reading now. First use brings up the browser's permission prompt. */
  activate: () => void;
};

const pageVisible = () => document.visibilityState !== "hidden";

export function useLocationGate(): LocationGate {
  const position = useAgentPosition({
    lazy: true,
    fresh: true,
    highAccuracy: LOCATION_GATE_HIGH_ACCURACY,
  });
  const { refresh, locating } = position;
  const [visible, setVisible] = useState(pageVisible);
  const [passedPoint, setPassedPoint] = useState<Point | null>(null);
  const live = locationStatus(position, LOCATION_GATE_ACCURACY_M);
  // The gate ends at the pass: a later reading never reopens it (ADR-0036).
  const status: LocationStatus = passedPoint ? { kind: "passed" } : live;
  const done = status.kind === "passed";
  const doneRef = useRef(done);
  doneRef.current = done;
  // Synchronous, unlike `locating`: two taps or events in one tick must take one
  // reading, because `refresh()` cancels a reading in flight and restarts it.
  const readingRef = useRef(locating);
  readingRef.current = locating;
  const read = useCallback(() => {
    if (readingRef.current) return;
    if ("geolocation" in navigator) readingRef.current = true;
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (live.kind === "passed" && !passedPoint && position.point) setPassedPoint(position.point);
  }, [live.kind, passedPoint, position.point]);

  useEffect(() => {
    let cancelled = false;
    async function startIfGranted() {
      try {
        const permission = await navigator.permissions?.query({ name: "geolocation" });
        if (!cancelled && !doneRef.current && permission?.state === "granted") read();
      } catch {
        // No Permissions API, or it refused the name: « Activer » starts the readings.
      }
    }
    function onVisibility() {
      const nowVisible = pageVisible();
      setVisible(nowVisible);
      if (nowVisible) void startIfGranted();
    }
    if (pageVisible()) void startIfGranted();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [read]);

  const coarse = status.kind === "coarse";
  useEffect(() => {
    if (!coarse || locating || !visible) return;
    const timer = setTimeout(refresh, LOCATION_GATE_RETRY_MS);
    return () => clearTimeout(timer);
  }, [coarse, locating, visible, refresh]);

  const point = passedPoint ?? (live.kind === "passed" ? position.point : null);
  const swipePoint = useCallback(async () => {
    const reading = await takeReading({
      fresh: true,
      highAccuracy: LOCATION_GATE_HIGH_ACCURACY,
      timeout: LOCATION_GATE_SWIPE_TIMEOUT_MS,
    });
    return reading.ok && reading.accuracy <= LOCATION_GATE_ACCURACY_M ? reading.point : point;
  }, [point]);

  return { status, point, swipePoint, activate: read };
}
