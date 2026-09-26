/**
 * The visit's right-hand pane from 768px — docs/design.md, "From 768px, the
 * form sits left" (spec-gh-126, GH #126): Visites précédentes, then the
 * place on Carte's own map.
 *
 * `RoundMap` is loaded lazily: `VisitScreen` only mounts this pane from
 * 768px, so a phone never fetches or parses Leaflet for a visit, and the
 * chunk stays shared with Carte rather than a second copy (ADR-0026 still
 * precaches it). Offline the map is not mounted at all — Leaflet requests a
 * tile on every pan (Carte's own reason).
 */
import { Component, lazy, Suspense, useId, type ReactNode } from "react";
import { useOnline } from "../hooks/use-online";
import type { VisitHistoryEntry } from "../../shared/schemas";
import { mapPins } from "./round-map";
import { useRound } from "./useRound";
import { VisitHistory } from "./VisitHistory";

const RoundMap = lazy(() => import("./RoundMap").then((module) => ({ default: module.RoundMap })));

/** No walking path: one place is not a route. */
const NO_PATH: [number, number][] = [];

/**
 * A map chunk that fails to load (a deploy landing mid-visit, or a
 * connection that reports online but carries nothing) must cost the map, not
 * the visit: with no boundary above it, a rejected `lazy` import unmounts the
 * whole screen and the draft with it. The app has no boundary of its own.
 */
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The place's own pin as Carte draws it — its walking-order number, gold only
 * when it is the next stop — so the two screens never disagree about it
 * (spec-gh-126 decision A). A place with no coordinates, or not on today's
 * list, has no pin to take, and gets no map. Its own component so `useRound`
 * (and its position reading) only runs while the map can show.
 */
function VisitMap({ prospectId }: { prospectId: string }) {
  const { list, point, refresh } = useRound();
  const pins = mapPins(list.now).filter((pin) => pin.id === prospectId);
  if (pins.length === 0) return null;

  return (
    <MapBoundary>
      <div className="border-border mt-6 h-72 overflow-hidden rounded-xl border">
        <Suspense fallback={null}>
          <RoundMap pins={pins} path={NO_PATH} position={point} recentre={refresh} />
        </Suspense>
      </div>
    </MapBoundary>
  );
}

export function VisitSidePane({
  prospectId,
  history,
  className,
}: {
  prospectId: string;
  history: readonly VisitHistoryEntry[];
  className?: string;
}) {
  const online = useOnline();
  const headingId = useId();
  return (
    <aside className={className} aria-labelledby={headingId}>
      <VisitHistory history={history} headingId={headingId} />
      {online && <VisitMap prospectId={prospectId} />}
    </aside>
  );
}
