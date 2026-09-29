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
 * Whether `identity` may send this outbox row. An unstamped row predates v3
 * with no identity cached, and belongs to whoever syncs it first
 * (docs/backlog/005) — holding it back would strand it for good. A row still
 * `unconfirmed` is never sendable, whatever `identity` is: the cache that
 * wrote it may not be who is really signed in (docs/backlog/013).
 */
export function sendableBy(identity: string): (row: OutboxStamp) => boolean {
  return (row) => !row.unconfirmed && (row.writtenBy === undefined || row.writtenBy === identity);
}
