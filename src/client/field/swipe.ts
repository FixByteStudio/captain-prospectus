/**
 * Pure gesture maths for the stop row swipe (GH #120, docs/design.md § Stop
 * row). Kept free of the DOM so the thresholds, axis lock and no-coords
 * clamp are unit-testable without `useSwipe` or a browser.
 */

/** Below this, on either axis, the gesture has not declared a direction yet. */
export const SWIPE_SLOP = 10;

/** Panel width and the distance past which a release starts the action. */
export const SWIPE_COMMIT = 96;

export type SwipeAxis = "horizontal" | "vertical" | null;

/**
 * Which axis a gesture belongs to, decided once `dx`/`dy` clear the slop.
 * `null` means "not decided yet" — the caller must not move the row or claim
 * the pointer until this resolves, so a vertical start never steals scroll.
 */
export function lockAxis(dx: number, dy: number): SwipeAxis {
  if (Math.abs(dx) <= SWIPE_SLOP && Math.abs(dy) <= SWIPE_SLOP) return null;
  return Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
}

/**
 * The row's live offset while dragging. Clamped to ±`SWIPE_COMMIT`: past that
 * a longer drag no longer moves the row further — it stops. A right swipe
 * with no coordinates for "Y aller" (`canRight` false) is clamped to 0, so
 * the row does not move at all in that direction — invariant "no coordinates
 * → no Y aller".
 */
export function clampOffset(dx: number, canRight: boolean): number {
  const max = canRight ? SWIPE_COMMIT : 0;
  return Math.min(max, Math.max(-SWIPE_COMMIT, dx));
}

/**
 * What a release starts, at the 96px commit distance. `canRight` false makes
 * a right swipe start nothing, matching `clampOffset` holding the row at 0.
 */
export function swipeAction(dx: number, canRight: boolean): "visit" | "navigate" | null {
  if (dx <= -SWIPE_COMMIT) return "visit";
  if (canRight && dx >= SWIPE_COMMIT) return "navigate";
  return null;
}

/**
 * The start swipe's track maths (docs/design.md › Before the swipe). Its commit
 * is a share of the track, not `SWIPE_COMMIT`: 96px on a 358px track would start
 * the day by accident, and a started tournée cannot be undone that day.
 */
export const TRACK_COMMIT_SHARE = 3 / 4;

/** The thumb follows the finger to the right and stops at the end of the track. */
export function thumbOffset(dx: number, travel: number): number {
  return Math.min(Math.max(0, travel), Math.max(0, dx));
}

/** Whether a release at `dx` starts the tournée: at least three quarters of the track. */
export function trackCommits(dx: number, travel: number): boolean {
  return travel > 0 && dx >= travel * TRACK_COMMIT_SHARE;
}
