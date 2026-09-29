/**
 * Which identity may send an outbox row — docs/backlog/005.
 *
 * Pure, and apart from `db.ts` on purpose: `db.ts` constructs `fieldDb` at
 * module scope, and `progress.ts` needs this one definition of "mine" with no
 * Dexie behind it (the outbox side and the log side must agree).
 */

/**
 * The email of the identity that wrote an outbox row.
 *
 * Dexie-only bookkeeping, never on the wire: the Worker takes `agentEmail`
 * from the verified JWT (INVARIANT 10), so the stamp only decides whether this
 * device may send the row *under the identity now signed in*. Optional because
 * a row queued before v3 with no identity cached has none; `runSync` treats
 * that row as the current identity's.
 *
 * `unconfirmed` (docs/backlog/013) marks a row written while the identity came
 * from the cache rather than from a live `/api/me` — the Access cookie the
 * next request carries may not match it. `confirmOutbox` (`db.ts`) clears the
 * flag once a live answer names who really holds the session.
 */
export type OutboxStamp = { writtenBy?: string; unconfirmed?: true };

/**
 * Whether a row is `identity`'s own — written by them, or unstamped (a
 * pre-v3 row with no identity cached, which belongs to whoever reads it
 * first, docs/backlog/005). This is "mine" for *display*: `outboxCounts`
 * (`db.ts`) and `dailyProgress` (`progress.ts`) use it so an agent's own
 * `unconfirmed` row still counts as pending and toward today's progress —
 * it is their own not-yet-sendable work, not another agent's (that
 * distinction is exactly what the `"unconfirmed"` sync state and its own
 * strip already say; conflating the two here would also make it disappear
 * from `copy.sync.pending`'s count while showing `copy.sync.heldBack`'s
 * "belongs to another agent," which is false).
 */
export function writtenByOrUnstamped(identity: string): (row: OutboxStamp) => boolean {
  return (row) => row.writtenBy === undefined || row.writtenBy === identity;
}

/**
 * Whether `identity` may *send* this outbox row — used only by `runSync`.
 * Everything `writtenByOrUnstamped` allows, minus a row still `unconfirmed`:
 * the cache that wrote it may not be who is really signed in
 * (docs/backlog/013), so it is never sendable, whatever `identity` is, even
 * though it still displays as this identity's own pending work.
 */
export function sendableBy(identity: string): (row: OutboxStamp) => boolean {
  const mine = writtenByOrUnstamped(identity);
  return (row) => mine(row) && !row.unconfirmed;
}
