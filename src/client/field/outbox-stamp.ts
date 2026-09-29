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
 * `unconfirmed` (backlog 013): set when the row was written while the
 * identity came from the offline cache, so the Access cookie it will
 * actually travel under is not yet known. `confirmOutbox` clears it — with
 * the live email, or with nothing on a 401 — before the row is ever eligible
 * to send.
 */
export type OutboxStamp = { writtenBy?: string; unconfirmed?: true };

/**
 * What a *new* row is written with: always a `writtenBy`, plus `unconfirmed`
 * while the identity that wrote it is cache-sourced. `queueVisit`,
 * `AddProspectScreen` and `SyncState.stamp` all share this one shape rather
 * than each spelling out `OutboxStamp & { writtenBy: string }`.
 */
export type WriteStamp = OutboxStamp & { writtenBy: string };

/**
 * Whether `identity` may send this outbox row. An unstamped row predates v3
 * with no identity cached, and belongs to whoever syncs it first
 * (docs/backlog/005) — holding it back would strand it for good. A row still
 * `unconfirmed` is never sendable, by anyone: the identity that wrote it has
 * not been confirmed against the live Access cookie yet (backlog 013).
 */
export function sendableBy(identity: string): (row: OutboxStamp) => boolean {
  return (row) =>
    row.unconfirmed !== true && (row.writtenBy === undefined || row.writtenBy === identity);
}

/**
 * Whether `identity` should *see* this row as theirs — today's progress and
 * the pending count, not the sync engine. An unconfirmed row written this
 * launch is this identity's own best guess at who it is; showing it as
 * "another agent's" (`heldBack`) instead of pending would be wrong the
 * instant an agent offline from launch logs their first visit (backlog 013).
 */
export function countsFor(identity: string): (row: OutboxStamp) => boolean {
  return (row) => row.unconfirmed === true || sendableBy(identity)(row);
}
