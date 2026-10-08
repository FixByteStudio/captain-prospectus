/**
 * Field-only helpers for a stop on the round. The rule that builds the round
 * itself lives in src/shared/today.ts, so the admin round view uses the same one.
 */
import type { TodayItem } from "../../shared/today";

/**
 * A link that shows the agent where the door is.
 *
 * OpenStreetMap rather than a `geo:` URI: `geo:` is an Android intent that iOS
 * Safari ignores entirely, so it would silently do nothing on half the phones
 * in use. An https link opens in whatever the agent has, and keeps the round on
 * OSM data, which is the source the map import uses too (ADR-0008).
 */
export function navigationUrl(item: Pick<TodayItem, "lat" | "lng" | "name">): string | null {
  if (item.lat === null || item.lng === null) return null;
  const lat = item.lat.toFixed(6);
  const lng = item.lng.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`;
}

/** The visit form for a stop — one spelling for the tap and the swipe (GH #120). */
export function visitPath(id: string): string {
  return `/tournee/${id}`;
}
