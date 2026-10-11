/**
 * The Google Places map import — ADR-0020, docs/domains/ingestion.md.
 *
 * Built to mirror `overpass.ts` (same shape, same purity, same contract with the
 * route) so the two read side by side. Worker-only, because of the key
 * (ADR-0020 §7). Everything here is pure; the route does the I/O.
 */
import { PLACES_MAX_RESULTS, type ProspectType } from "../shared/constants";
import type { FoundPlace, Vertex } from "../shared/schemas";
import { sha256Hex } from "./hex";
import { num, round5, text } from "./overpass";

/**
 * Part of the cache key, so a changed request cannot be served a stale answer
 * built by the old one. **Bump this whenever the request below changes.**
 *
 * The `g` prefix is load-bearing: Google and Overpass answers share one table,
 * and two providers hashing the same numbers must not collide.
 */
export const PLACES_QUERY_VERSION = "gv1";

export const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";

/**
 * Keep it Pro-tier: docs/domains/ingestion.md, "The field mask is the bill"
 * (under "Request"; ADR-0020 §5). Google rejects a mask containing spaces.
 */
export const PLACES_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types";

/**
 * The Overpass query's scope in Google's vocabulary (Place Types, Table A, which
 * has no `food_truck`). `restaurant` also matches `italian_restaurant` and the
 * like, which carry the broader type as well.
 */
export const PLACES_INCLUDED_TYPES = [
  "restaurant",
  "fast_food_restaurant",
  "cafe",
  "coffee_shop",
  "bar",
  "pub",
  "meal_takeaway",
  "ice_cream_shop",
  "food_court",
] as const;

/** Whole metres: a radius handle dragged a centimetre is the same search. */
function roundRadius(radius: number): number {
  return Math.round(radius);
}

/**
 * The Nearby Search request body: docs/domains/ingestion.md, "Request" and
 * "Limits"; why `BE`: docs/vision.md.
 *
 * `regionCode` biases results and formats addresses, silently, so places.test.ts
 * pins it. `languageCode` is French although Brussels is bilingual, because the
 * agents read French. Neither changes the SKU.
 */
export function buildPlacesBody(center: Vertex, radius: number): string {
  const [lat, lng] = center;
  return JSON.stringify({
    includedTypes: PLACES_INCLUDED_TYPES,
    maxResultCount: PLACES_MAX_RESULTS,
    rankPreference: "DISTANCE",
    languageCode: "fr",
    regionCode: "BE",
    locationRestriction: {
      circle: {
        center: { latitude: Number(round5(lat)), longitude: Number(round5(lng)) },
        radius: roundRadius(radius),
      },
    },
  });
}

/**
 * SHA-256 of the query version, the normalised centre and the rounded radius:
 * a nudged pin must land on the same, already-paid-for entry.
 */
export async function circleHash(center: Vertex, radius: number): Promise<string> {
  const [lat, lng] = center;
  const input = `${PLACES_QUERY_VERSION}:${round5(lat)} ${round5(lng)}:${roundRadius(radius)}`;
  return sha256Hex(input);
}

/* ------------------------------------------------------------ type mapping */

/** The parts of a Places result we ask for and read. */
type Place = {
  id?: unknown;
  displayName?: { text?: unknown };
  formattedAddress?: unknown;
  location?: { latitude?: unknown; longitude?: unknown };
  primaryType?: unknown;
  types?: unknown;
};

const GOOGLE_TYPE_TO_TYPE: Readonly<Record<string, ProspectType>> = {
  restaurant: "restaurant",
  fast_food_restaurant: "fast_food",
  meal_takeaway: "fast_food",
  cafe: "cafe",
  coffee_shop: "cafe",
  bar: "bar",
  pub: "bar",
  // A parlour with seats, like OSM's ice_cream: "other" is the honest bucket.
  ice_cream_shop: "other",
  food_court: "other",
};

/**
 * `primaryType` first, then the broader `types` array
 * (docs/domains/ingestion.md, "Field mapping").
 */
function prospectType(place: Place): ProspectType {
  const primary = text(place.primaryType);
  const known = primary ? GOOGLE_TYPE_TO_TYPE[primary] : undefined;
  if (known) return known;

  if (Array.isArray(place.types)) {
    for (const value of place.types) {
      const name = text(value);
      const match = name ? GOOGLE_TYPE_TO_TYPE[name] : undefined;
      if (match) return match;
    }
  }
  return "other";
}

/**
 * The kitchen from the `<kitchen>_restaurant` type name
 * (docs/domains/ingestion.md, "Field mapping").
 */
function cuisine(place: Place): string | null {
  const candidates = [text(place.primaryType), ...(Array.isArray(place.types) ? place.types : [])];
  for (const value of candidates) {
    const name = text(value);
    const match = name?.match(/^(.+)_restaurant$/);
    // `fast_food_restaurant` is a kind of place, not a kind of food.
    if (match?.[1] && match[1] !== "fast_food") return match[1];
  }
  return null;
}

/**
 * `google/<placeId>` — **never change this format**: it is tier 1 of the dedupe
 * key (ADR-0020 §6), so a change duplicates every place already imported.
 */
function sourceRef(place: Place): string | null {
  const id = text(place.id);
  return id ? `google/${id}` : null;
}

function toCandidate(place: Place): FoundPlace | null {
  const ref = sourceRef(place);
  if (!ref) return null;

  // Google always sends a display name for a place it returns. `named` stays
  // false-able anyway: the panel renders both providers, and a missing name is
  // a candidate we must show and refuse rather than one we may invent.
  const name = text(place.displayName?.text);

  return {
    name: name ?? "",
    named: name !== null,
    type: prospectType(place),
    lat: num(place.location?.latitude),
    lng: num(place.location?.longitude),
    address: text(place.formattedAddress),
    // Enterprise-tier fields, deliberately not requested (ADR-0020).
    phone: null,
    website: null,
    cuisine: cuisine(place),
    sourceRef: ref,
  };
}

/**
 * Map a raw Nearby Search body to candidates, or `null` when it is not a Places
 * answer at all (an `error` object, a proxy page), which the route turns into a
 * 502. A missing `places` is zero results, not a malformed answer (docs/domains/ingestion.md).
 */
export function toCandidates(
  body: string,
): { candidates: FoundPlace[]; truncated: boolean } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const answer = parsed as { places?: unknown; error?: unknown };
  if (answer.error !== undefined) return null;

  const places = answer.places ?? [];
  if (!Array.isArray(places)) return null;

  const candidates: FoundPlace[] = [];
  for (const place of places) {
    const candidate = toCandidate(place as Place);
    if (candidate) candidates.push(candidate);
  }

  // Google's cap, reached: the answer is a prefix of what the circle holds, and
  // there is no page token to ask for the rest.
  return { candidates, truncated: places.length >= PLACES_MAX_RESULTS };
}
