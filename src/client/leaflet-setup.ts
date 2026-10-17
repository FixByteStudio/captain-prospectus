/**
 * The Leaflet setup the admin import canvas (admin/import/MapCanvas.tsx) and
 * the field's round map (field/RoundMap.tsx) share. Only those two lazy chunks
 * import it, so Leaflet never reaches the entry chunk; it reads `copy/field`
 * because the round map is field-reachable (INVARIANT 15).
 */
import L from "leaflet";
import { copy } from "./copy/field";

/**
 * design.md principle 5 and the reduced-motion block in app.css: motion only
 * where something changed. A pan that animates is decoration on a map.
 */
export function motionOptions(): Pick<
  L.MapOptions,
  "zoomAnimation" | "fadeAnimation" | "markerZoomAnimation"
> {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { zoomAnimation: !still, fadeAnimation: !still, markerZoomAnimation: !still };
}

/**
 * INVARIANT 11: attribution on every map. Passing it to the tile layer rather
 * than drawing our own line means it cannot be laid out away. The tiles are
 * OSM whichever provider is searched (ADR-0020).
 */
export function addOsmTiles(map: L.Map): void {
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: copy.attribution,
    maxZoom: 19,
  }).addTo(map);
}

/**
 * A `@theme` token's computed value, so Leaflet's inline styles stay
 * on-palette, dark theme included. Leaflet's vector layers take a CSS colour
 * string, not a class, which is the one place a map cannot reach for Tailwind.
 */
export function readToken(token: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
}
