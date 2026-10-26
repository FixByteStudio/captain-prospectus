/**
 * The live feed's rows — ADR-0010, ADR-0036 R13, docs/design.md "The live feed".
 *
 * Pure, so it can be tested: the part worth pinning lives here and
 * `VisitsScreen` only draws it. A row is a door-day, which the server always
 * sends whole, so an incoming row replaces the one held under its `key`.
 */
import type { AdminDoorDay } from "../../../shared/schemas";

/**
 * Fold a poll's answer into what the screen already holds.
 *
 * Keyed by `key` and re-sorted: a second visit to a door-day already held
 * arrives as that whole door-day again, which must replace the row rather than
 * add one. Keeping the merge idempotent means a re-delivery is free, which the
 * cursor relies on only for a door-day a later visit reached again.
 */
export function mergeDoorDays(
  existing: readonly AdminDoorDay[],
  incoming: readonly AdminDoorDay[],
): AdminDoorDay[] {
  if (incoming.length === 0) return existing as AdminDoorDay[];

  const byKey = new Map(existing.map((row) => [row.key, row]));
  for (const row of incoming) byKey.set(row.key, row);

  return [...byKey.values()].sort(
    // Newest arrival first, and `key` as the tie-break, as the server sorts, so
    // two rows received in the same millisecond do not swap between two polls.
    (a, b) => b.listedAt - a.listedAt || a.key.localeCompare(b.key),
  );
}

/**
 * Keys the screen should mark as new: a door-day this poll added, or one held
 * whose `listedAt` grew because another visit reached it (design.md: a second
 * visit is an arrival too). A re-delivery of what we hold is not news.
 */
export function arrivedKeys(
  existing: readonly AdminDoorDay[],
  incoming: readonly AdminDoorDay[],
): string[] {
  const held = new Map(existing.map((row) => [row.key, row.listedAt]));
  return incoming
    .filter((row) => {
      const was = held.get(row.key);
      return was === undefined || row.listedAt > was;
    })
    .map((row) => row.key);
}
