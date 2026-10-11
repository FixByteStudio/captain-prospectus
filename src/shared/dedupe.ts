/**
 * Dedupe key — docs/domains/prospecting.md.
 *
 * One place must exist once. The key is computed server-side and is unique in
 * the database, so a re-import updates instead of duplicating, and a field
 * prospect that already exists collides instead of creating a twin.
 */

/** Strip accents, lowercase, collapse everything non-alphanumeric to a single "-". */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type DedupeInput = {
  name: string;
  sourceRef?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
};

/**
 * `normalize`, unless that leaves nothing: a name written only in another
 * script ("餃子館", "مطعم") would key as empty and collide with every other
 * such place (#50). Only then are letters, marks, digits and symbols of any
 * script kept, so every key that `normalize` already produced stays the same.
 */
function keyPart(value: string): string {
  return (
    normalize(value) ||
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{S}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
  );
}

/**
 * Three tiers, in order:
 *   1. `ref:<source_ref>`                     — the source gives a stable id (OSM node/123)
 *   2. `geo:<name>:<lat 3dp>:<lng 3dp>`       — ~110 m cell
 *   3. `addr:<name>:<address>`                — no coordinates
 *
 * Known limits, accepted for v1: two branches of a chain in the same cell merge;
 * the same place either side of a cell boundary does not.
 */
export function dedupeKey(input: DedupeInput): string {
  const ref = input.sourceRef?.trim();
  if (ref) return `ref:${ref}`;

  const name = keyPart(input.name);
  if (typeof input.lat === "number" && typeof input.lng === "number") {
    return `geo:${name}:${input.lat.toFixed(3)}:${input.lng.toFixed(3)}`;
  }

  const address = input.address?.trim();
  if (address) return `addr:${name}:${keyPart(address)}`;

  // Nothing but a name. Keyed on the name alone so two nameless-location
  // imports of the same business still collide rather than multiplying.
  return `name:${name}`;
}
