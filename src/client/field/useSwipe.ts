/**
 * Turns pointer events on a stop row's header into `swipe.ts`'s pure maths —
 * GH #120, docs/design.md § Stop row. Keeps `StopRow` declarative: it reads
 * `offset`/`dragging` for the transform and spreads `handlers` on the button.
 *
 * The click after a swipe: browsers still fire `click` on the button after
 * `pointerup` when the pointer never left it. `onClickCapture` swallows that
 * one click when the gesture moved past the slop, so a swipe never also
 * expands the row (the tap path is untouched) — but only a real pointer click
 * (`detail !== 0`); a keyboard or assistive-technology activation (`detail
 * === 0`) right after a swipe must still work, so it is never swallowed. The
 * ref that remembers a swipe is cleared once it has swallowed one click, or
 * on the next `pointerdown`, whichever comes first.
 *
 * Only the gesture's first (primary, left-button) pointer drives it: a second
 * finger's `pointerdown` mid-drag is ignored rather than re-basing `start`,
 * and every subsequent event is matched against that pointer's id.
 */
import { useRef, useState } from "react";
import { clampOffset, lockAxis, swipeAction, type SwipeAxis } from "./swipe";

export function useSwipe({
  canRight,
  onVisit,
  onNavigate,
}: {
  /** Whether the stop has coordinates — a right swipe with none starts nothing. */
  canRight: boolean;
  onVisit: () => void;
  onNavigate: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const axis = useRef<SwipeAxis>(null);
  /** Set once a gesture has moved past the slop; read by `onClickCapture`. */
  const swiped = useRef(false);

  function reset() {
    start.current = null;
    axis.current = null;
    setOffset(0);
    setDragging(false);
  }

  function onPointerDown(event: React.PointerEvent<HTMLElement>) {
    // A second finger (never `isPrimary`) or a non-left button never starts or
    // re-bases a gesture. A primary pointerdown always does, so a gesture whose
    // pointerup was lost (lifted off the button inside the slop) can't wedge
    // the row.
    if (!event.isPrimary || event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    axis.current = null;
    swiped.current = false;
  }

  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!start.current || event.pointerId !== start.current.pointerId) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;

    if (axis.current === null) {
      axis.current = lockAxis(dx, dy);
      if (axis.current === "vertical") {
        // The browser owns this pan (touch-action: pan-y); forget the gesture
        // rather than fight it — it will end in a pointercancel, not us. Any
        // movement past the slop is not a tap, so the trailing click (a mouse
        // drag fires one even though touch-action never applies) is still
        // swallowed.
        swiped.current = true;
        start.current = null;
        return;
      }
      if (axis.current === "horizontal") {
        swiped.current = true;
        setDragging(true);
        // May be missing in tests / unsupported browsers — best effort only.
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } else {
        return; // Still within the slop: undecided.
      }
    }

    setOffset(clampOffset(dx, canRight));
  }

  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (!start.current || event.pointerId !== start.current.pointerId) return;
    if (axis.current === "horizontal") {
      const dx = event.clientX - start.current.x;
      const action = swipeAction(dx, canRight);
      if (action === "visit") onVisit();
      else if (action === "navigate") onNavigate();
    }
    reset();
  }

  function onPointerCancel(event: React.PointerEvent<HTMLElement>) {
    if (!start.current || event.pointerId !== start.current.pointerId) return;
    reset();
  }

  function onClickCapture(event: React.MouseEvent<HTMLElement>) {
    if (swiped.current && event.detail !== 0) {
      event.preventDefault();
      event.stopPropagation();
      swiped.current = false;
    }
  }

  return {
    offset,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  };
}
