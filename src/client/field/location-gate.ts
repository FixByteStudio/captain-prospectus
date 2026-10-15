/**
 * The location gate's numbers and its status table — docs/design.md › The
 * location dialog, ADR-0036. Pure, so the table is testable without a phone.
 *
 * Provisional until the owner's pavement test: the threshold and
 * `enableHighAccuracy` are recorded in the PR that ships them.
 */

/** A reading passes at or under this many metres. The loose end of the 100–200 m target. */
export const LOCATION_GATE_ACCURACY_M = 200;

/** Wait between two readings while the last one was too coarse. */
export const LOCATION_GATE_RETRY_MS = 2_000;

/** The gate's readings ask for the coarse fix too, until the pavement test says otherwise. */
export const LOCATION_GATE_HIGH_ACCURACY = false;

export type LocationStatus =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "coarse"; meters: number }
  | { kind: "refused" }
  | { kind: "unavailable" }
  | { kind: "passed" };

export type LocationReading = {
  accuracy: number | null;
  locating: boolean;
  denied: boolean;
  refused: boolean;
};

export function locationStatus(state: LocationReading, threshold: number): LocationStatus {
  const { accuracy, locating, denied, refused } = state;
  // A failed reading wipes nothing from the hook, so `denied` outranks the old accuracy.
  if (!denied && accuracy !== null && accuracy <= threshold) return { kind: "passed" };
  if (denied) {
    if (locating) return { kind: "locating" };
    return { kind: refused ? "refused" : "unavailable" };
  }
  // A coarse reading stays on screen while the next one is taken: no flicker every 2 s.
  if (accuracy !== null) return { kind: "coarse", meters: Math.ceil(accuracy) };
  return locating ? { kind: "locating" } : { kind: "idle" };
}
