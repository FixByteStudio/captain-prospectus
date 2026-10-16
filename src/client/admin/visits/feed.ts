/**
 * The live feed's cursor — ADR-0010, ADR-0036 R13, docs/design.md "The live feed".
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
 * add one. `since` being exclusive is not quite enough on its own either: two
 * visits can share a `receivedAt` millisecond, and the cursor would then either
 * re-deliver a row or skip it. Keeping the merge idempotent means a re-delivery
 * is free.
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
    (a, b) => b.receivedAt - a.receivedAt || a.key.localeCompare(b.key),
  );
}

/**
 * The cursor for the next poll: the highest `receivedAt` held.
 *
 * Deliberately not the server's clock. Asking for everything after the newest
 * row we actually hold means a visit written between the query and the response
 * is delivered next time rather than skipped forever.
 */
export function nextSince(rows: readonly AdminDoorDay[]): number {
  let highest = 0;
  for (const row of rows) {
    if (row.receivedAt > highest) highest = row.receivedAt;
  }
  return highest;
}

/**
 * Keys the screen should mark as new: a door-day this poll added, or one held
 * whose `receivedAt` grew because another visit reached it (design.md: a second
 * visit is an arrival too). A re-delivery of what we hold is not news.
 */
export function arrivedKeys(
  existing: readonly AdminDoorDay[],
  incoming: readonly AdminDoorDay[],
): string[] {
  const held = new Map(existing.map((row) => [row.key, row.receivedAt]));
  return incoming
    .filter((row) => {
      const was = held.get(row.key);
      return was === undefined || row.receivedAt > was;
    })
    .map((row) => row.key);
}
