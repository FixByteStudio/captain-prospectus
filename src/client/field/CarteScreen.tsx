/**
 * Carte — docs/design.md, "Carte" (spec-gh-121, spec-gh-122, GH #121, #122).
 *
 * Below 768px the map (or the offline canvas) sits above a persistent
 * `CarteSheet` showing the selected stop; from 768px the sheet is replaced by
 * `CarteList`, a left pane, with the map on the right — never both at once
 * (`useIsMobile()` decides, so there is never a second "Visiter" link in the
 * DOM). `RoundMap` itself always renders in the same slot of one tree, so
 * crossing 768px only changes its pane's classes and siblings, never
 * remounts it — a rotation or a pane swap is a resize `RoundMap`'s own
 * `ResizeObserver` re-lays out around, not a lost pan/zoom. Offline, the map
 * is never created at all: Leaflet requests a tile on every pan, so "no tile
 * request offline" only holds when there is no map to pan (Design Notes).
 */
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { MapIcon, RouteIcon } from "lucide-react";
import { buttonVariants } from "@/ui/button-variants";
import { useIsMobile } from "@/hooks/use-mobile";
import { copy } from "../copy";
import { cn } from "../lib/utils";
import { useOnline } from "../hooks/use-online";
import { CarteList } from "./CarteList";
import { CarteSheet } from "./CarteSheet";
import { PositionDenied } from "./PositionDenied";
import { mapPins, walkingPath } from "./round-map";
import { RoundMap } from "./RoundMap";
import { useRound } from "./useRound";

/**
 * Cancels `<main>`'s own `px-4 pt-6` (`App.tsx`) and fills the rest with a
 * height built from where this pane actually starts, not a fixed band-height
 * guess: `SyncStrip` and `UpdatePrompt` sit between the band and `<main>`
 * (`App.tsx`'s `FieldFrame`) and change height on their own — offline, a
 * pending count, an update landing — so a guess of "band height only" leaves
 * the canvas taller than the viewport under exactly the conditions a phone in
 * the field hits, sliding the re-centre control and the attribution line
 * under the tab bar. `useCarteTop` below measures the real value into
 * `--carte-top`; only the bottom term stays a fixed calc off the shell's own
 * tokens (below 768px the tab bar is fixed and owns its own safe-area inset,
 * `--spacing-tab-bar-height`, app.css:219, 437-438; from 768px the tabs move
 * into the band and the bottom margin is the page's usual one instead,
 * app.css:441-445's own `.pb-tab-bar` override, mirrored here since a
 * full-bleed canvas cannot also carry that class's padding-bottom).
 */
const FULL_BLEED = cn(
  "relative -mx-4 -mt-6",
  "h-[calc(100dvh_-_var(--carte-top,0px)_-_var(--spacing-tab-bar-height)_-_env(safe-area-inset-bottom,0px))]",
  "md:h-[calc(100dvh_-_var(--carte-top,0px)_-_var(--spacing)*6)]",
);

/**
 * Where this pane's own top edge actually sits, written to `--carte-top` on
 * the element itself so `FULL_BLEED`'s `calc()` can read it. Re-measured on
 * `resize` and on a `ResizeObserver` over `document.body`, since the strip
 * and the update prompt change the body's layout without this component's
 * own props changing at all.
 */
function useCarteTop<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      element.style.setProperty("--carte-top", `${top}px`);
    };
    measure();

    window.addEventListener("resize", measure);
    // happy-dom has no ResizeObserver in every version this repo has run
    // against; a missing one just means the unit tests only re-measure on
    // `resize`, not on the strip's own height changing — real browsers keep
    // both.
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(document.body);
    }

    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  return ref;
}

/** The offline canvas — no tiles, no Leaflet instance, ever (Design Notes).
 * Always sized `size-full` by its caller (`mapArea`), which already carries
 * the phone/tablet sizing classes. */
function OfflineCanvas({ className }: { className?: string }) {
  return (
    <div className={cn("bg-secondary relative", className)}>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="bg-card border-border w-full max-w-sm rounded-xl border p-6 text-center shadow-sm">
          <span className="bg-secondary text-muted-foreground mx-auto flex size-11 items-center justify-center rounded-lg">
            <MapIcon aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-2.5 text-base font-semibold">{copy.carte.offline}</p>
          <Link
            to="/tournee"
            className={cn(buttonVariants({ variant: "secondary", size: "touch" }), "mt-3 w-full")}
          >
            <RouteIcon aria-hidden="true" />
            {copy.carte.showList}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CarteScreen() {
  const { list, point, denied, refresh } = useRound();
  const online = useOnline();
  const isMobile = useIsMobile();
  const paneRef = useCarteTop<HTMLDivElement>();

  // The id `RoundMap`'s `onSelect` or a `CarteList` row last chose; null
  // means "the next stop" (Design Notes). Resolved against `list.now` on
  // every render rather than reset by an effect, so a stop that syncs away
  // while selected falls back on its own (matrix, "Selected stop leaves").
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = list.now.find((item) => item.id === selectedId) ?? list.now[0] ?? null;
  const selectedIndex = selected ? list.now.indexOf(selected) + 1 : 0;

  // Same "expand in place" semantics as `TodayScreen`'s own row toggle: tapping
  // an already-expanded row collapses it back to "the next stop".
  const toggle = (id: string) => setSelectedId((current) => (current === id ? null : id));

  const pins = mapPins(list.now);
  const path = walkingPath(pins);

  const deniedNotice = denied && (
    <div className="bg-card border-border absolute inset-x-4 top-3 z-10 rounded-lg border p-3 shadow-sm">
      <PositionDenied onRetry={refresh} className="text-sm" />
    </div>
  );

  // One tree for all four cases (phone/tablet × online/offline), `RoundMap`
  // always in the same slot, so crossing 768px never remounts it (only
  // `mapArea`'s own classes and its siblings change) — a remount there would
  // drop the pan/zoom the agent just set, exactly what the `ResizeObserver`
  // in `RoundMap` exists to preserve instead. Going offline still unmounts
  // it: Leaflet requests a tile on every pan, so "no tile request offline"
  // only holds when there is no map to pan (Design Notes).
  const mapArea = (
    <div className={cn("relative", isMobile ? "min-h-0 flex-1" : "md:col-span-3")}>
      {online ? (
        <>
          {deniedNotice}
          <RoundMap
            pins={pins}
            path={path}
            position={point}
            recentre={refresh}
            onSelect={setSelectedId}
          />
        </>
      ) : (
        <OfflineCanvas className="size-full" />
      )}
    </div>
  );

  return (
    <div
      ref={paneRef}
      className={cn(FULL_BLEED, isMobile ? "flex flex-col" : "md:grid md:grid-cols-5 md:gap-4")}
    >
      {!isMobile && (
        <div className="md:col-span-2 md:overflow-y-auto">
          <CarteList list={list} selectedId={selectedId} onToggle={toggle} />
        </div>
      )}
      {mapArea}
      {isMobile && <CarteSheet item={selected} index={selectedIndex} />}
    </div>
  );
}
