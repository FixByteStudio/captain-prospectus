/**
 * Pins and the walking path for Carte — docs/design.md, "Carte" (spec-gh-121).
 *
 * Pure so the matrix rows are tested without a browser or Leaflet: `RoundMap`
 * only draws what this computes, and never re-derives the order or the
 * numbering itself. The items are `useRound().stops`, the same array
 * `TodayScreen` renders — one source, shared through `useRound`. The admin
 * round view passes the server's stops with the same swipe numbers (ADR-0036).
 */
export type MapPin = {
  id: string;
  /** The stop's own number — the one its row or card shows, even when a stop
   * between it and the previous pin carries no coordinates and so draws no
   * pin of its own, and even when the number has gaps (ADR-0036). */
  number: number;
  lat: number;
  lng: number;
  /** The next stop's pin is gold; every other pin is card-coloured. */
  next: boolean;
  /** For the pin's accessible name (spec-gh-122, `copy.carte.pinLabel`) —
   * pins are keyboard-reachable once `RoundMap` gets an `onSelect`. */
  name: string;
};

/** What a pin needs of a stop: `TourneeItem` on the phone, a `RoundStop` on the admin side. */
export type NumberedItem = {
  id: string;
  number: number;
  lat: number | null;
  lng: number | null;
  name: string;
};

/**
 * One pin per stop that has coordinates, in the order given. A stop without
 * coordinates is skipped here — it still gets a number on its row, just not a
 * point to draw (spec-gh-121 matrix, "Stop without coordinates").
 */
export function mapPins(items: readonly NumberedItem[]): MapPin[] {
  const pins: MapPin[] = [];
  items.forEach((item, i) => {
    if (item.lat === null || item.lng === null) return;
    pins.push({
      id: item.id,
      number: item.number,
      lat: item.lat,
      lng: item.lng,
      next: i === 0,
      name: item.name,
    });
  });
  return pins;
}

/**
 * The dashed line through the pins, stop to stop — never touching the agent's
 * own position (Design Notes: a straight segment from there would read as a
 * route, and ADR-0002 rules out a routing service that could draw a real one).
 */
export function walkingPath(pins: readonly MapPin[]): [number, number][] {
  return pins.map((pin) => [pin.lat, pin.lng]);
}
