/**
 * The swipe « Commencer la tournée » — docs/design.md › Before the swipe.
 *
 * One real `<button>`: Enter, Space and a screen reader's activation (a click
 * with `detail === 0`) start the tournée at once; a pointer tap only nudges the
 * thumb, because a started tournée cannot be undone that day. A drag past three
 * quarters of the track commits (`swipe.ts`). The component owns the gesture
 * only: what starting does lives in `StartScreen`.
 */
import { useEffect, useId, useRef, useState } from "react";
import { ChevronsRightIcon, MapPinIcon } from "lucide-react";
import { copy } from "../copy/field";
import { cn } from "../lib/utils";
import { lockAxis, thumbOffset, trackCommits, type SwipeAxis } from "./swipe";

/** The thumb is 56px (`size-14`) in a 64px track with 4px (`inset-1`) around it. */
const THUMB_PX = 56;
const INSET_PX = 4;
/** A tap's hint: how far the thumb moves right before sliding back. */
const NUDGE_PX = 24;
const NUDGE_MS = 180;

export function StartSwipe({
  ready,
  starting,
  onStart,
}: {
  /** False until a position reading exists. */
  ready: boolean;
  /** The write is running: the thumb stays at the end and nothing else starts. */
  starting: boolean;
  onStart: () => void;
}) {
  const inactive = !ready || starting;
  const labelId = useId();
  const track = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{ x: number; y: number; id: number; travel: number } | null>(null);
  const axis = useRef<SwipeAxis>(null);
  /** A drag moved past the slop, so the click that follows it is not a tap. */
  const dragged = useRef(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  /** The tap nudge's return; cleared on unmount, since a swipe unmounts this screen. */
  const nudge = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (nudge.current) clearTimeout(nudge.current);
    },
    [],
  );

  // While writing the thumb sits at the far end; the failure path flips
  // `starting` back and the thumb returns with it.
  const [travelAtEnd, setTravelAtEnd] = useState(0);
  const shown = starting ? travelAtEnd : offset;

  function reset() {
    gesture.current = null;
    axis.current = null;
    setDragging(false);
    setOffset(0);
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (inactive || !event.isPrimary || event.button !== 0) return;
    const width = track.current?.getBoundingClientRect().width ?? 0;
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      travel: Math.max(0, width - THUMB_PX - 2 * INSET_PX),
    };
    axis.current = null;
    dragged.current = false;
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || event.pointerId !== g.id) return;
    const dx = event.clientX - g.x;
    if (axis.current === null) {
      axis.current = lockAxis(dx, event.clientY - g.y);
      if (axis.current === "vertical") {
        // The browser owns this pan (touch-action: pan-y): a vertical start
        // scrolls the preview and never moves the thumb.
        dragged.current = true;
        gesture.current = null;
        return;
      }
      if (axis.current !== "horizontal") return;
      dragged.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    setOffset(thumbOffset(dx, g.travel));
  }

  function onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || event.pointerId !== g.id) return;
    if (axis.current === "horizontal" && trackCommits(event.clientX - g.x, g.travel)) {
      setTravelAtEnd(g.travel);
      setOffset(0);
      gesture.current = null;
      axis.current = null;
      setDragging(false);
      onStart();
      return;
    }
    reset();
  }

  function onPointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
    if (gesture.current && event.pointerId === gesture.current.id) reset();
  }

  function onClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (inactive) return;
    if (event.detail === 0) {
      // Keyboard or assistive technology: the start itself, full width.
      const width = track.current?.getBoundingClientRect().width ?? 0;
      setTravelAtEnd(Math.max(0, width - THUMB_PX - 2 * INSET_PX));
      onStart();
      return;
    }
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    // A tap: nudge and come back, the hint to slide.
    setOffset(NUDGE_PX);
    if (nudge.current) clearTimeout(nudge.current);
    nudge.current = setTimeout(() => setOffset(0), NUDGE_MS);
  }

  const label = starting ? copy.start.starting : ready ? copy.start.swipeLabel : copy.start.waiting;

  return (
    <button
      ref={track}
      type="button"
      aria-label={copy.start.swipeName}
      aria-describedby={labelId}
      aria-disabled={inactive || undefined}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // pan-y: a vertical start scrolls the preview behind the fixed track.
      className={cn(
        "bg-secondary border-border focus-visible:ring-ring/50 relative block h-16 w-full touch-pan-y overflow-hidden rounded-full border text-base font-bold outline-none select-none focus-visible:ring-[3px]",
        inactive && "text-muted-foreground",
      )}
    >
      {/* The gold wash fills in behind the thumb. */}
      <span
        aria-hidden
        className={cn(
          "bg-primary/20 absolute inset-y-0 left-0 rounded-full motion-reduce:transition-none",
          !dragging && "transition-[width] duration-150",
        )}
        style={{ width: shown + THUMB_PX + 2 * INSET_PX }}
      />
      <span id={labelId} className="relative flex h-full items-center justify-center pr-6 pl-16">
        {label}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-1 flex size-14 items-center justify-center rounded-full ring-1 ring-inset motion-reduce:transition-none",
          !dragging && "transition-transform duration-150",
          inactive && !starting
            ? "bg-card text-muted-foreground ring-border"
            : "bg-primary text-primary-foreground ring-primary-edge",
        )}
        style={{ transform: `translateX(${shown}px)` }}
      >
        {inactive && !starting ? (
          <MapPinIcon className="size-6" />
        ) : (
          <ChevronsRightIcon className="size-6" />
        )}
      </span>
    </button>
  );
}
