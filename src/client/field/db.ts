/**
 * The phone's local store — docs/domains/field-operations.md.
 *
 * INVARIANT: this is a cache plus an outbox, never the source of truth. The
 * outbox is the only copy of a visit until the server accepts it, so a schema
 * upgrade must MIGRATE outbox rows and never clear them.
 */
import Dexie, { type Table } from "dexie";
import type {
  FieldProspect,
  MeResponse,
  Prospect,
  Script,
  TodayTournee,
  TourneeStop,
  TourneeStopSync,
  TourneeSync,
  Visit,
  VisitedStop,
  VisitHistoryEntry,
} from "../../shared/schemas";
import { brusselsPeriod } from "../../shared/period";
import { dropReading } from "./last-reading";
import { joinersFor } from "./tournee-joiners";
import { stopsOfToday } from "./tournee-stops";
import { sendableBy, writtenByOrUnstamped, type OutboxStamp } from "./outbox-stamp";

// Re-exported so the store module still names everything a row carries;
// pure callers (`tournee-stops.ts`, `sync.ts`) import from `outbox-stamp.ts`.
export { sendableBy, writtenByOrUnstamped, type OutboxStamp };

export type MetaValues = {
  script: Script | null;
  lastSyncAt: number;
  /**
   * The last identity `/api/me` returned.
   *
   * Cached because the shell cannot reach the network on a pavement with no
   * signal, and an agent opening the app there must still get their round.
   * It is a convenience for rendering, never proof of anything: the Worker
   * re-derives identity from the session on every request
   * (INVARIANT 10), so a tampered copy of this unlocks nothing.
   */
  identity: MeResponse;
};
export type MetaKey = keyof MetaValues;

export type StoredVisit = Visit & OutboxStamp;
export type StoredFieldProspect = FieldProspect & OutboxStamp;
export type StoredTournee = TourneeSync & OutboxStamp;
export type StoredStop = TourneeStopSync & OutboxStamp;
/** A pulled stop remembers its tournée, which the nested wire shape leaves implicit. */
export type PulledStop = TourneeStop & { tourneeId: string };
export type PulledTournee = Omit<TodayTournee, "stops">;
export type MetaRow = { key: MetaKey; value: MetaValues[MetaKey] };

export class FieldDb extends Dexie {
  prospects!: Table<Prospect, string>;
  outboxProspects!: Table<StoredFieldProspect, string>;
  outboxVisits!: Table<StoredVisit, string>;
  meta!: Table<MetaRow, string>;
  /**
   * Past visits pulled from the server, so the visit form can still show
   * « Visites précédentes » with no signal (field-operations.md: "offline it
   * shows what is cached"). A cache, never a source of truth — unlike the
   * outbox, losing this loses nothing.
   */
  visitHistory!: Table<VisitHistoryEntry, string>;
  /** The swipe's tournée and its numbered stops, queued until the server lists them in `accepted`. */
  outboxTournees!: Table<StoredTournee, string>;
  outboxStops!: Table<StoredStop, string>;
  /** Today's tournée as the last pull returned it: a cache, replaced wholesale. */
  tournees!: Table<PulledTournee, string>;
  tourneeStops!: Table<PulledStop, string>;
  /** Today's door-days from the last pull: the counter and Carnet read them. */
  visitedStops!: Table<VisitedStop, string>;

  constructor(name = "captain-prospectus") {
    super(name);
    this.version(1).stores({
      prospects: "id, status, assignedTo",
      outboxProspects: "id",
      outboxVisits: "id, prospectId",
      meta: "key",
    });
    /**
     * v2 ADDS a table and changes no existing one, so Dexie carries every row
     * across untouched and no upgrade function is needed. That is the only
     * shape of migration allowed to run near the outbox: the sync-contract-change
     * skill's step 3 says a version bump must migrate outbox rows, never clear
     * them, and the safest way to honour that is not to touch them.
     */
    this.version(2).stores({
      visitHistory: "id, prospectId",
    });
    /**
     * v3 stamps every queued row with `writtenBy`. It modifies rows in place
     * and deletes none (sync-contract-change step 3): a row queued before the
     * upgrade takes the cached identity, the best guess at who wrote it, and
     * stays unstamped when none is cached rather than being dropped.
     */
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        const row = (await tx.table("meta").get("identity" satisfies MetaKey)) as
          { value?: { email?: unknown } } | undefined;
        const email = row?.value?.email;
        if (typeof email !== "string") return;
        const stamp = (item: OutboxStamp) => {
          item.writtenBy ??= email;
        };
        await tx.table("outboxVisits").toCollection().modify(stamp);
        await tx.table("outboxProspects").toCollection().modify(stamp);
      });
    /**
     * v4 ADDS a table and changes no existing one — the same shape v2 used,
     * for the same reason v2's comment gives: the sync-contract-change
     * skill's step 3 says a version bump must migrate outbox rows, never
     * clear them, and the safest way to honour that is not to touch them.
     */
    this.version(4).stores({
      sentVisits: "id, sentAt",
    });
    /**
     * v5 ADDS five tables (ADR-0036) and changes none, the same shape v2 and v4
     * used, so the outbox is not touched.
     */
    this.version(5).stores({
      outboxTournees: "id",
      outboxStops: "id, tourneeId, prospectId",
      tournees: "id",
      tourneeStops: "id, tourneeId",
      visitedStops: "prospectId",
    });
    /**
     * v6 DROPS `sentVisits` (the phone-only log the counter no longer reads) and
     * touches no other table, so no outbox row moves: the same no-upgrade shape
     * v2, v4 and v5 used.
     */
    this.version(6).stores({ sentVisits: null });
  }
}

export const fieldDb = new FieldDb();

export async function getMeta<K extends MetaKey>(
  db: FieldDb,
  key: K,
): Promise<MetaValues[K] | undefined> {
  const row = await db.meta.get(key);
  return row?.value as MetaValues[K] | undefined;
}

export async function setMeta<K extends MetaKey>(
  db: FieldDb,
  key: K,
  value: MetaValues[K],
): Promise<void> {
  await db.meta.put({ key, value });
}

export type OutboxCounts = {
  /**
   * Rows `identity` wrote (or unstamped, pre-v3): its own work, waiting on
   * the network. Includes a row still `unconfirmed` — that is a reason
   * `runSync` will not send it yet, not a reason to stop counting it as
   * this identity's own (docs/backlog/013).
   */
  pending: number;
  /** Rows another identity wrote, which this one never sends. */
  heldBack: number;
};

/** Split the outbox between what `identity` owns and what it holds back. */
export async function outboxCounts(db: FieldDb, identity: string): Promise<OutboxCounts> {
  const mine = writtenByOrUnstamped(identity);
  const [prospects, visits, tournees, stops] = await Promise.all([
    db.outboxProspects.toArray(),
    db.outboxVisits.toArray(),
    db.outboxTournees.toArray(),
    db.outboxStops.toArray(),
  ]);
  // A swipe reads as one element: its stops count only once their tournée has
  // left the outbox, so a day of 20 stops is not "21 éléments en attente".
  const queued = new Set(tournees.map((t) => t.id));
  const lonelyStops = stops.filter((stop) => !queued.has(stop.tourneeId));
  const rows: OutboxStamp[] = [...prospects, ...visits, ...tournees, ...lonelyStops];
  const pending = rows.filter(mine).length;
  return { pending, heldBack: rows.length - pending };
}

/**
 * The swipe's write: the tournée and every numbered stop in one transaction, so
 * a day with stops but no tournée (or the reverse) is never queued. Stamped like
 * a visit, and `unconfirmed` under the same rule (docs/backlog/013).
 */
export async function startTournee(
  db: FieldDb,
  day: { tournee: TourneeSync; stops: readonly TourneeStopSync[] },
  identity: string,
  unconfirmed = false,
): Promise<void> {
  const flag = unconfirmed ? ({ unconfirmed: true } as const) : {};
  await db.transaction("rw", db.outboxTournees, db.outboxStops, async () => {
    await db.outboxTournees.add({ ...day.tournee, writtenBy: identity, ...flag });
    await db.outboxStops.bulkAdd(day.stops.map((s) => ({ ...s, writtenBy: identity, ...flag })));
  });
}

/**
 * Appends to today's tournée every open prospect it does not hold yet, as stops
 * numbered after the highest number ever given (ADR-0036 › Numbers). Stamped like
 * the swipe's own stops, and never updated afterwards (invariant 2).
 *
 * One transaction reads the tables and writes the stops, and IndexedDB runs two
 * of them one after the other, so two tabs cannot both append the same prospect.
 * Nothing is appended before the swipe: the swipe freezes those itself.
 */
export async function appendJoiners(
  db: FieldDb,
  identity: string,
  now: number,
  unconfirmed = false,
): Promise<void> {
  const flag = unconfirmed ? ({ unconfirmed: true } as const) : {};
  await db.transaction(
    "rw",
    [
      db.prospects,
      db.outboxProspects,
      db.tournees,
      db.tourneeStops,
      db.outboxTournees,
      db.outboxStops,
    ],
    async () => {
      const [prospects, outboxProspects, pulledTournees, pulledStops, outboxTournees, outboxStops] =
        await Promise.all([
          db.prospects.toArray(),
          db.outboxProspects.toArray(),
          db.tournees.toArray(),
          db.tourneeStops.toArray(),
          db.outboxTournees.toArray(),
          db.outboxStops.toArray(),
        ]);
      const today = stopsOfToday(
        { pulledTournees, pulledStops, outboxTournees, outboxStops, identity },
        brusselsPeriod(now, 1),
      );
      if (!today) return;
      const joiners = joinersFor({
        tournee: { id: today.tourneeId },
        stops: today.stops,
        prospects,
        outboxProspects,
        identity,
        now,
      });
      if (joiners.length === 0) return;
      await db.outboxStops.bulkAdd(joiners.map((s) => ({ ...s, writtenBy: identity, ...flag })));
    },
  );
}

/**
 * Queues a field prospect and, in the same transaction, appends it to today's
 * tournée: a place added after the swipe is never queued without its stop, nor the
 * reverse. Stamped like a visit (docs/backlog/013).
 */
export async function queueFieldProspect(
  db: FieldDb,
  prospect: FieldProspect,
  identity: string,
  unconfirmed = false,
  now = Date.now(),
): Promise<void> {
  const flag = unconfirmed ? ({ unconfirmed: true } as const) : {};
  await db.transaction(
    "rw",
    [
      db.prospects,
      db.outboxProspects,
      db.tournees,
      db.tourneeStops,
      db.outboxTournees,
      db.outboxStops,
    ],
    async () => {
      await db.outboxProspects.add({ ...prospect, writtenBy: identity, ...flag });
      await appendJoiners(db, identity, now, unconfirmed);
    },
  );
}

/**
 * The one queueing function (docs/domains/field-operations.md#offline-sync): the
 * outbox `add`, which the counter reads back as today's unsent door-days.
 *
 * `unconfirmed` (docs/backlog/013) is set when `identity` came from the cache
 * rather than a live `/api/me`: the outbox row is stamped with the cached email,
 * but marked as not yet safe to send, until `confirmOutbox` re-stamps it once a
 * live answer says who is really signed in.
 */
export async function queueVisit(
  db: FieldDb,
  visit: Visit,
  identity: string,
  unconfirmed = false,
): Promise<void> {
  const flag = unconfirmed ? ({ unconfirmed: true } as const) : {};
  await db.outboxVisits.add({ ...visit, writtenBy: identity, ...flag });
}

/**
 * Replace a prospect's cached history with what the server just returned.
 *
 * Scoped to one prospect: another prospect's cache is still valid, and an
 * agent offline for the rest of the round should keep it.
 */
export async function cacheVisitHistory(
  db: FieldDb,
  prospectId: string,
  entries: readonly VisitHistoryEntry[],
): Promise<void> {
  await db.transaction("rw", db.visitHistory, async () => {
    await db.visitHistory.where("prospectId").equals(prospectId).delete();
    if (entries.length > 0) await db.visitHistory.bulkPut([...entries]);
  });
}

/**
 * Drop everything this device caches *about an agent*, keeping the outbox.
 *
 * Used when the identity that owns the cache stops being valid: another agent
 * signed in, or the Worker answered `/api/me` with a 401 because the session was
 * revoked or the user deactivated (docs/security.md, "stolen phone"). Without
 * this, the round and the visit history survive the revocation and the next
 * launch with no network shows them again — offline there is no 401 to refuse.
 *
 * The outbox is deliberately not touched: INVARIANT 5 lets only the server's
 * `accepted` list delete a queued visit, and a revoked session is not that.
 * The next identity does not send those rows either: each is stamped with its
 * writer and `runSync` holds back any stamped by someone else.
 */
export async function clearAgentCache(db: FieldDb): Promise<void> {
  // The last position reading is the previous agent's too (ADR-0028).
  dropReading();
  await Promise.all([
    db.prospects.clear(),
    db.visitHistory.clear(),
    db.tournees.clear(),
    db.tourneeStops.clear(),
    db.visitedStops.clear(),
    db.meta.delete("identity" satisfies MetaKey),
    // The pull that filled the cache above was this agent's: the next one must
    // read as "never loaded" until it lands (the tournée gate).
    db.meta.delete("lastSyncAt" satisfies MetaKey),
  ]);
}

/**
 * Every outbox table: a stamp helper that forgets one strands its rows. Typed
 * as `Table<OutboxStamp>` so one `modify` serves them all (Dexie's `modify` is
 * not callable on a union of tables).
 */
function outboxTables(db: FieldDb): Table<OutboxStamp, string>[] {
  return [db.outboxVisits, db.outboxProspects, db.outboxTournees, db.outboxStops];
}

/**
 * Re-stamp every `unconfirmed` outbox row with `email` and drop the
 * flag, in one transaction — docs/backlog/013.
 *
 * Called on every live `/api/me`, not only when *this* session opened
 * cache-sourced: a row can be `unconfirmed` from an earlier launch that was
 * killed before its own confirmation landed (the phone going offline right
 * after queueing a visit, say), and a later launch whose first answer comes
 * back live must still confirm it — otherwise it sits unstamped for ever
 * (`sendableBy` refuses it from every identity). Idempotent and cheap when
 * nothing is flagged, so calling it unconditionally costs nothing. A row not
 * carrying the flag is untouched, so this never re-attributes work `runSync`
 * has already decided is (or is not) sendable. It never deletes a row
 * (INVARIANT 5).
 */
export async function confirmOutbox(db: FieldDb, email: string): Promise<void> {
  const confirm = (row: OutboxStamp) => {
    if (!row.unconfirmed) return;
    row.writtenBy = email;
    delete row.unconfirmed;
  };
  await db.transaction("rw", outboxTables(db), async () => {
    for (const table of outboxTables(db)) await table.toCollection().modify(confirm);
  });
}

/**
 * Drop the `unconfirmed` flag from every outbox row, keeping each
 * row's own `writtenBy` — docs/backlog/013.
 *
 * Called on a 401: an expired cookie cannot confirm *anyone*, so nothing here
 * is re-stamped to "the current identity" (there may be more than one, if
 * rows from different cache-sourced launches are still flagged). Each row
 * already carries the cached email it was written under; dropping only the
 * flag lets the ordinary `writtenBy` check (`sendableBy`, docs/backlog/005)
 * take back over — held back from anyone else, same as a confirmed row
 * always has been. It never deletes a row (INVARIANT 5).
 */
export async function releaseUnconfirmed(db: FieldDb): Promise<void> {
  const release = (row: OutboxStamp) => {
    delete row.unconfirmed;
  };
  await db.transaction("rw", outboxTables(db), async () => {
    for (const table of outboxTables(db)) await table.toCollection().modify(release);
  });
}
