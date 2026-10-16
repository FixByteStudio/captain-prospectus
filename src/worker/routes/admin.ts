/**
 * Admin routes — docs/api.md, docs/domains/prospecting.md.
 *
 * Everything here is behind `requireAdmin` (mounted in index.ts): importing,
 * editing and assigning prospects is admin-only (identity-access.md). The
 * remaining stubs answer 501 rather than pretending to succeed.
 */
import { Hono } from "hono";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import { chunk } from "../../shared/chunk";
import {
  DAY_MS,
  DUPLICATES_PAGE_SIZE,
  DUPLICATES_SCAN_LIMIT,
  EXPORT_ROWS,
  ORPHAN_CANDIDATES,
  OPEN_STATUSES,
  ORPHANS_PAGE_SIZE,
  OUTCOMES,
  OVERPASS_CACHE_TTL_MS,
  PLACES_CACHE_TTL_MS,
  SCRIPTS_PAGE_SIZE,
  STATUSES,
  type Outcome,
  type RefusalReason,
  type Source,
  type Status,
} from "../../shared/constants";
import {
  CSV_ATTRIBUTION,
  csvDisposition,
  csvFile,
  csvFilename,
  csvTimestamp,
} from "../../shared/csv";
import { dedupeKey, normalize } from "../../shared/dedupe";
import { foldForSearch } from "../../shared/search";
import {
  brusselsMidnightDaysFromNow,
  brusselsPeriod,
  deltaOf,
  periodDates,
  periodOffsets,
} from "../../shared/period";
import { cellAndNeighbours, cellOf, distanceMeters } from "../../shared/geo";
import { isProbablySamePlace } from "../../shared/similarity";
import {
  agentEmailParamSchema,
  assignSchema,
  dashboardQuerySchema,
  mergeSchema,
  orphanRepairSchema,
  overpassImportSchema,
  placesImportSchema,
  visitsSinceQuerySchema,
  prospectBatchSchema,
  prospectIdParamSchema,
  prospectPatchSchema,
  prospectsExportQuerySchema,
  prospectsQuerySchema,
  scriptCreateSchema,
  visitsExportQuerySchema,
  visitIdParamSchema,
} from "../../shared/schemas";
import type {
  AdminVisitsResponse,
  AgentRoundResponse,
  AgentsResponse,
  OrphanCandidate,
  OrphanedVisit,
  OrphanRepairResult,
  OrphansResponse,
  AssignResult,
  DashboardResponse,
  DuplicatesResponse,
  ImportResult,
  ImportsResponse,
  MergeResult,
  AreaSearchResponse,
  ProspectsResponse,
  RecapResponse,
  Script,
  ScriptsResponse,
} from "../../shared/schemas";
import { activeRoster, activeRosterMember } from "../auth";
import { validate } from "../validate";
import { listImports, writeImportLog } from "../import-log";
import { readAgentPosition } from "../agent-position";
import { doorDaysBetween, doorDaysOn, doorDaysTouched } from "../door-days";
import { openAssignedProspects } from "../round";
import { agentsStartedOn, todayTournee } from "../tournee";
import { boundParamsPerRow, getDb, type Db } from "../db/client";
import { prospects, scripts, users, visits, visitsOrphaned } from "../db/schema";
import { readMapCache, writeMapCache } from "../map-cache";
import {
  OVERPASS_ENDPOINT,
  OVERPASS_USER_AGENT,
  buildOverpassQuery,
  polygonHash,
  toCandidates,
} from "../overpass";
import {
  PLACES_ENDPOINT,
  PLACES_FIELD_MASK,
  buildPlacesBody,
  circleHash,
  toCandidates as toPlaceCandidates,
} from "../places";
import type { NewProspectRow, ProspectRow } from "../db/schema";
import { markLikelyDuplicates } from "../likely-duplicates";
import { deriveProspectStatus } from "./status";
import { toWireProspect, toWireScript } from "./wire";
import type { AppEnv } from "../types";

export const adminRoutes = new Hono<AppEnv>();

/**
 * Overpass is a public service that is sometimes slow, rate-limited or down
 * (ADR-0008). The message says what happened and what to do, because "502" on
 * its own reads as "the app is broken" rather than "someone else's server is".
 */
const OVERPASS_UNAVAILABLE = {
  error: "overpass_failed",
  message: "OpenStreetMap n'a pas répondu. Réessayez dans quelques instants.",
} as const;

/** The same, for the other provider (ADR-0020). */
const PLACES_UNAVAILABLE = {
  error: "places_failed",
  message: "Google Places n'a pas répondu. Réessayez dans quelques instants.",
} as const;

/**
 * No key on this deployment. A different fact from "the provider failed", and
 * the admin can act on it — nobody has run `wrangler secret put` — so it gets
 * its own code and its own status rather than a 502 that reads as Google's
 * fault (ADR-0020).
 */
const PLACES_UNCONFIGURED = {
  error: "places_unconfigured",
  message: "Le fournisseur Google n'est pas configuré sur ce serveur.",
} as const;

/* ------------------------------------------------------------------- people */

/**
 * Everyone a prospect can be assigned to: the active `users` rows (ADR-0029).
 * Admins are included — in a two-person field team an admin may well walk a round.
 */
adminRoutes.get("/agents", async (c) => {
  const roster = await activeRoster(getDb(c.env.DB));
  return c.json<AgentsResponse>({ agents: roster });
});

/**
 * One agent's stops still to do today, with the swipe's numbers (ADR-0036), and
 * their last reading, which only places the marker. The same stops the phone's
 * Tournée and Carte show: no visit today and not left. `tournee` is null before the
 * swipe. Never cached: a position is personal data and stale the minute it is served.
 */
adminRoutes.get("/agents/:email/round", validate("param", agentEmailParamSchema), async (c) => {
  const { email } = c.req.valid("param");
  const db = getDb(c.env.DB);
  if (!(await activeRosterMember(db, email))) return c.json({ error: "not_found" }, 404);
  const now = Date.now();
  const [open, visited, position] = await Promise.all([
    openAssignedProspects(db, email),
    doorDaysOn(db, { dayStart: brusselsMidnightDaysFromNow(now, 0), agentEmail: email }),
    readAgentPosition(db, email, now),
  ]);
  const visitedIds = new Set(visited.map((d) => d.prospectId));
  const tournee = await todayTournee(db, email, now, visitedIds);
  const openById = new Map(open.map((p) => [p.id, p]));
  const stops = (tournee?.stops ?? []).flatMap((stop) => {
    const prospect = openById.get(stop.prospectId);
    // A visited stop has left Tournée, and a left one is not in the open map.
    if (stop.left || visitedIds.has(stop.prospectId) || !prospect) return [];
    return [{ number: stop.number, prospect: toWireProspect(prospect) }];
  });
  c.header("Cache-Control", "no-store");
  return c.json<AgentRoundResponse>({
    tournee: tournee ? { startedAt: tournee.startedAt, stops } : null,
    position,
  });
});

/**
 * A syntactically valid email is not enough.
 *
 * Assigning to an address nobody holds is silent data loss in slow motion: the
 * prospect disappears from every agent's sync pull, which matches on the exact
 * email, while the admin list still shows it as assigned and handled. One typo
 * and a restaurant is never visited again. So the assignee has to be on the
 * roster (an active user), and `null` — unassign — is always allowed.
 */
async function unknownAssignee(email: string | null, db: Db): Promise<boolean> {
  return email !== null && !(await activeRosterMember(db, email));
}

/* -------------------------------------------------------------------- recap */

/**
 * The sidebar's recap card — docs/api.md › The recap card. Polled every 15 s
 * from every admin page, so it stays three statements beside the dashboard's
 * thirteen rather than a figure added to them (free-tier-budget.md).
 */
adminRoutes.get("/recap", async (c) => {
  const now = Date.now();
  const dayStart = brusselsMidnightDaysFromNow(now, 0);
  const db = getDb(c.env.DB);
  const [roster, byAgent, activeAgents] = await Promise.all([
    activeRoster(db),
    // One row per sender, on `visits_received_idx`: a day has a handful.
    // `n` is the sender's door-days of today (ADR-0036). `visited_at` is clamped
    // to `received_at`, so a visit made today and already received is among these
    // rows: today's door-days received so far, one per prospect for one agent.
    // One made before midnight and synced after it is yesterday's, in no recap.
    db
      .select({
        email: visits.agentEmail,
        n: sql<number>`count(distinct case when ${visits.visitedAt} >= ${dayStart} then ${visits.prospectId} end)`.mapWith(
          Number,
        ),
        last: sql<number>`max(${visits.receivedAt})`.mapWith(Number),
      })
      .from(visits)
      .where(
        and(
          gte(visits.receivedAt, dayStart),
          lt(visits.receivedAt, brusselsMidnightDaysFromNow(now, 1)),
        ),
      )
      .groupBy(visits.agentEmail),
    // « Actifs aujourd'hui » is « Agents en tournée »: the same helper (ADR-0036).
    agentsStartedOn(db, dayStart),
  ]);

  // A sender off the roster still counts as a door-day, never as an active
  // agent (`agentsStartedOn` counts the roster only), so the card cannot read "3 / 2".
  const lastReceivedAt = byAgent.length === 0 ? null : Math.max(...byAgent.map((r) => r.last));
  // One day asked for, so exactly one date comes back.
  const [date] = periodDates(dayStart, 1);
  if (date === undefined) throw new Error("periodDates returned no day for one day");
  c.header("Cache-Control", "no-store");
  return c.json<RecapResponse>({
    date,
    activeAgents,
    rosterSize: roster.length,
    visitsToday: byAgent.reduce((n, r) => n + r.n, 0),
    lastReceivedAt,
    serverTime: now,
  });
});

/* ---------------------------------------------------------------- dashboard */

/**
 * Tableau de bord — docs/api.md › The dashboard, which defines every figure.
 *
 * Read-only, and computed here rather than on the client, so each figure has
 * one definition (docs/api.md › The dashboard).
 */
adminRoutes.get("/dashboard", validate("query", dashboardQuerySchema), async (c) => {
  const { period } = c.req.valid("query");
  // One clock read, so every boundary below agrees on which day it is.
  const now = Date.now();
  const { from, to, previousFrom } = brusselsPeriod(now, period);
  const db = getDb(c.env.DB);
  // 1 for a door-day in the current period, 0 for one in the previous period.
  // A door-day sits on one Brussels day, and a period starts at a midnight, so
  // its latest visit decides.
  const inCurrent = sql`(case when dd.visited_at >= ${from} then 1 else 0 end)`;
  const days = periodDays(from, to, period);
  // Both periods' door-days: the current period's days count 0.., the previous
  // period's -period..-1, each with its own offsets (`periodOffsets` allows one
  // clock change per period, and `[previousFrom, to)` can hold two).
  const bothPeriods = doorDaysBetween({
    from: previousFrom,
    to,
    dayKey: twoPeriodsDayKey({ from, to, previousFrom }, period),
  });
  const currentPeriod = doorDaysBetween({ from, to, dayKey: days.dayOf });
  // Snapshots that ignore `period` (docs/api.md › The dashboard).
  const todayStart = brusselsMidnightDaysFromNow(now, 0);
  const dueSoonBefore = brusselsMidnightDaysFromNow(now, 7);

  const [
    visitCounts,
    open,
    conversions,
    byDay,
    convertedDaily,
    pipelineRows,
    agentVisits,
    agentOpen,
    agentConverted,
    due,
    agentsToday,
    roster,
    inactiveAgent,
  ] = await Promise.all([
    /**
     * Both periods' door-days in one range read (`doorDaysBetween`, which
     * `visits_visited_idx` serves). Not filtered on `merged_into`: an absorbed
     * prospect keeps its visits and they still happened. Quarantined visits live
     * in another table, so they are out by construction. `visited_at` is already
     * clamped (INVARIANT 12). `flyersGiven` follows `period`, same rows as
     * `value` (GH #177); a door-day counts if any of its visits gave one.
     */
    db.all<{ value: number; previous: number; flyersGiven: number }>(sql`
      select
        coalesce(sum(${inCurrent}), 0) as value,
        coalesce(sum(1 - ${inCurrent}), 0) as previous,
        coalesce(sum(case when ${inCurrent} = 1 and dd.flyer_given then 1 else 0 end), 0) as flyersGiven
      from (${bothPeriods}) dd
    `),
    // A snapshot of now: the period does not apply. Split by status for the
    // card's mini-bar; the figure is the sum, so the two never disagree.
    db
      .select({ status: prospects.status, n: count() })
      .from(prospects)
      .where(and(isNull(prospects.mergedInto), inArray(prospects.status, [...OPEN_STATUSES])))
      .groupBy(prospects.status),
    conversionCounts(db, { from, to, previousFrom, bothPeriods }),
    visitsByDay(db, days, currentPeriod),
    convertedByDay(db, days, currentPeriod),
    // Pipeline par statut: every live prospect, a snapshot like `open`.
    db
      .select({ status: prospects.status, n: count() })
      .from(prospects)
      .where(isNull(prospects.mergedInto))
      .groupBy(prospects.status),
    // Activité par agent. Same door-days as `visits.value`'s current period.
    db.all<{ email: string; n: number }>(sql`
      select agent_email as email, count(*) as n
      from (${currentPeriod})
      group by agent_email
    `),
    db
      .select({
        email: sql<string>`${prospects.assignedTo}`,
        followUp:
          sql<number>`coalesce(sum(case when ${prospects.status} = ${"follow_up" satisfies Status} then 1 else 0 end), 0)`.mapWith(
            Number,
          ),
        // Every live assigned prospect gives its assignee a row; only the
        // open ones count.
        n: sql<number>`coalesce(sum(case when ${inArray(prospects.status, [...OPEN_STATUSES])} then 1 else 0 end), 0)`.mapWith(
          Number,
        ),
      })
      .from(prospects)
      .where(and(isNull(prospects.mergedInto), isNotNull(prospects.assignedTo)))
      .groupBy(prospects.assignedTo),
    agentConversions(db, currentPeriod),
    // Relances dues: "today or earlier" is before `to`, Brussels midnight
    // tomorrow, so the day boundary stays brusselsPeriod's. A snapshot.
    // `dueSoonBefore` (> `to`) widens the where clause so one range read
    // serves both `n` (< to) and "sous 7 jours" (< dueSoonBefore, overdue
    // included), a second sum rather than a second statement (GH #177).
    db
      .select({
        n: sql<number>`coalesce(sum(case when ${prospects.nextVisitAt} < ${to} then 1 else 0 end), 0)`.mapWith(
          Number,
        ),
        dueSoon: count(),
      })
      .from(prospects)
      .where(
        and(
          isNull(prospects.mergedInto),
          eq(prospects.status, "follow_up" satisfies Status),
          lt(prospects.nextVisitAt, dueSoonBefore),
        ),
      ),
    // Agents en tournée: roster members who started today's tournée, the recap's
    // figure too (`agentsStartedOn`, ADR-0036).
    agentsStartedOn(db, todayStart),
    activeRoster(db),
    // Prospects sans agent actif: a snapshot like `open`, on the same SQL as
    // the list's `inactiveAgent` filter, so the list totals it.
    db
      .select({ n: count() })
      .from(prospects)
      .where(
        and(
          isNull(prospects.mergedInto),
          inArray(prospects.status, [...OPEN_STATUSES]),
          NO_ACTIVE_AGENT,
        ),
      ),
  ]);

  const value = Number(visitCounts[0]?.value ?? 0);
  const previous = Number(visitCounts[0]?.previous ?? 0);
  const rate = rateOf(conversions.converted, conversions.visited);
  const previousRate = rateOf(conversions.convertedPrevious, conversions.visitedPrevious);
  const openByStatus = { new: 0, assigned: 0, follow_up: 0 };
  for (const row of open) {
    if (row.status in openByStatus) openByStatus[row.status as keyof typeof openByStatus] = row.n;
  }

  return c.json<DashboardResponse>({
    period,
    from,
    to,
    visits: {
      value,
      previous,
      delta: deltaOf(value, previous),
      byDay: byDay.map((d) => OUTCOMES.reduce((n, o) => n + d.counts[o], 0)),
    },
    // Every row, not the split's three keys: a status added to OPEN_STATUSES
    // still counts in the figure.
    openProspects: open.reduce((n, row) => n + row.n, 0),
    openProspectsByStatus: openByStatus,
    converted: {
      value: conversions.converted,
      previous: conversions.convertedPrevious,
      delta: deltaOf(conversions.converted, conversions.convertedPrevious),
      byDay: convertedDaily,
    },
    conversionRate: {
      value: rate,
      previous: previousRate,
      // Points, not a relative change: the one exception to the Delta rule.
      delta: rate === null || previousRate === null ? null : rate - previousRate,
      visitedProspects: { value: conversions.visited, previous: conversions.visitedPrevious },
    },
    visitsByDay: byDay,
    pipeline: pipelineOf(pipelineRows),
    agents: agentRows(
      roster.map((r) => r.email),
      agentVisits.map((r) => ({ email: r.email, n: Number(r.n) })),
      agentOpen,
      agentConverted,
    ),
    followUpsDue: due[0]?.n ?? 0,
    flyersGiven: Number(visitCounts[0]?.flyersGiven ?? 0),
    agentsActiveToday: agentsToday,
    followUpsDueSoon: { value: due[0]?.dueSoon ?? 0, dueBefore: dueSoonBefore },
    inactiveAgentProspects: inactiveAgent[0]?.n ?? 0,
  });
});

function pipelineOf(rows: { status: Status; n: number }[]): DashboardResponse["pipeline"] {
  const pipeline = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const row of rows) if (row.status in pipeline) pipeline[row.status] = row.n;
  return pipeline;
}

/**
 * One row per roster email, zeros included. An email off the roster (a
 * deactivated user) has no row, though their visits stay in the totals
 * (docs/api.md › The dashboard).
 */
function agentRows(
  roster: string[],
  visitRows: { email: string; n: number }[],
  openRows: { email: string; followUp: number; n: number }[],
  convertedRows: { email: string; n: number }[],
): DashboardResponse["agents"] {
  const byEmail = new Map<string, DashboardResponse["agents"][number]>();
  for (const email of roster) {
    byEmail.set(email, { email, visits: 0, converted: 0, followUp: 0, openProspects: 0 });
  }
  for (const v of visitRows) {
    const r = byEmail.get(v.email);
    if (r) r.visits = v.n;
  }
  for (const o of openRows) {
    const r = byEmail.get(o.email);
    if (r) {
      r.followUp = o.followUp;
      r.openProspects = o.n;
    }
  }
  for (const c of convertedRows) {
    const r = byEmail.get(c.email);
    if (r) r.converted = c.n;
  }
  return [...byEmail.values()].sort(
    (a, b) => b.visits - a.visits || (a.email < b.email ? -1 : a.email > b.email ? 1 : 0),
  );
}

/** A prospect keyed as its survivor, so an absorbed one counts once, as the place it became. */
const PROSPECT_KEY = sql`coalesce(${prospects.mergedInto}, ${prospects.id})`;

/**
 * The prospect's status is still the manual one: a later visit sets status and
 * leaves status_set_at alone (the complement of visitWins in status.ts).
 */
const MANUAL_STATUS_IN_FORCE = sql`(${prospects.lastVisitAt} is null or ${prospects.lastVisitAt} <= ${prospects.statusSetAt})`;

/**
 * An agent's Convertis: distinct prospects, keyed by `PROSPECT_KEY`, with a
 * door-day of theirs whose latest outcome is `converted` in the current period
 * (`currentPeriod` is `doorDaysBetween` over it). A manual conversion has no
 * visitor and is credited to nobody.
 */
async function agentConversions(
  db: Db,
  currentPeriod: SQL,
): Promise<{ email: string; n: number }[]> {
  const converted = "converted" satisfies Outcome;
  const rows = await db.all<{ email: string; n: number }>(sql`
    select dd.agent_email as email, count(distinct ${PROSPECT_KEY}) as n
    from (${currentPeriod}) dd
    inner join ${prospects} on ${prospects.id} = dd.prospect_id
    where dd.outcome = ${converted}
    group by dd.agent_email
  `);
  return rows.map((r) => ({ email: r.email, n: Number(r.n) }));
}

function rateOf(n: number, d: number): number | null {
  return d === 0 ? null : n / d;
}

/**
 * The period's Brussels days, for the per-day figures below. `dayOf(t)` is
 * the SQL day index of instant `t` in the period: `(t + offset) / DAY_MS` is
 * the Brussels day number, and the offset switches once at most
 * (`periodOffsets`), which keeps a statement at a handful of bound parameters
 * however long the period (INVARIANT 7).
 */
type PeriodDays = { from: number; to: number; dates: string[]; dayOf: (t: SQL) => SQL };

/** `dayOf` for `[from, to)`: days counted from `from`'s, so `from`'s own day is 0. */
function dayIndexer(from: number, to: number): (t: SQL) => SQL {
  const { before, after, changeAt } = periodOffsets(from, to);
  const firstDay = Math.floor((from + before) / DAY_MS);
  // D1 binds a JS number as REAL, so the division is a float one: the cast
  // floors it (the operand is never negative).
  return (t) =>
    sql`cast((${t} + case when ${t} >= ${changeAt} then ${after} else ${before} end) / ${DAY_MS} as integer) - ${firstDay}`;
}

function periodDays(from: number, to: number, period: number): PeriodDays {
  return { from, to, dates: periodDates(from, period), dayOf: dayIndexer(from, to) };
}

/**
 * A day key for a statement that spans both periods: the current period's days
 * are 0.., the previous period's are -period..-1. Each period has its own
 * offsets because `periodOffsets` assumes at most one clock change in the span
 * it is given, and two periods can hold two (INVARIANT 7 stays: a dozen binds).
 */
function twoPeriodsDayKey(
  { from, to, previousFrom }: { from: number; to: number; previousFrom: number },
  period: number,
): (t: SQL) => SQL {
  const current = dayIndexer(from, to);
  const previous = dayIndexer(previousFrom, from);
  return (t) =>
    sql`(case when ${t} >= ${from} then ${current(t)} else ${previous(t)} - ${period} end)`;
}

/**
 * Visites dans le temps: the period's door-days per Brussels day and latest
 * outcome. Same door-days as `visits` above (`currentPeriod`, whose `day` is
 * `dayOf`'s): merged prospects' in, quarantined ones out, `visited_at` clamped.
 */
async function visitsByDay(
  db: Db,
  { dates }: PeriodDays,
  currentPeriod: SQL,
): Promise<DashboardResponse["visitsByDay"]> {
  const rows = await db.all<{ day: number; outcome: Outcome; n: number }>(sql`
    select day, outcome, count(*) as n
    from (${currentPeriod})
    group by day, outcome
  `);
  const result = dates.map((date) => ({
    date,
    counts: Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>,
  }));
  for (const row of rows) {
    const entry = result[Number(row.day)];
    // Out of range cannot happen for a visit in [from, to); skip rather than
    // grow the array if it ever did.
    if (entry && row.outcome in entry.counts) entry.counts[row.outcome] = Number(row.n);
  }
  return result;
}

/**
 * Convertis per Brussels day, for the card's sparkline: the same events as
 * `conversionCounts`' current period (door-days whose latest outcome is
 * `converted`, or a manual conversion), and each prospect on the day of its
 * first one, so the series sums to `converted.value` (docs/api.md › The
 * dashboard).
 */
async function convertedByDay(
  db: Db,
  { from, to, dates, dayOf }: PeriodDays,
  currentPeriod: SQL,
): Promise<number[]> {
  const converted = "converted" satisfies Status;
  const rows = await db.all<{ day: number; n: number }>(sql`
    select ${dayOf(sql`first_at`)} as day, count(*) as n
    from (
      select prospect_key, min(at) as first_at
      from (
        select ${PROSPECT_KEY} as prospect_key, dd.visited_at as at
        from (${currentPeriod}) dd
        inner join ${prospects} on ${prospects.id} = dd.prospect_id
        where dd.outcome = ${converted}
        union all
        select ${PROSPECT_KEY}, ${prospects.statusSetAt}
        from ${prospects}
        where ${prospects.status} = ${converted}
          and ${prospects.statusSetAt} >= ${from}
          and ${prospects.statusSetAt} < ${to}
          -- The manual status still in force, as in conversionCounts.
          and ${MANUAL_STATUS_IN_FORCE}
      )
      group by prospect_key
    )
    group by day
  `);
  const result = dates.map(() => 0);
  for (const row of rows) {
    const i = Number(row.day);
    if (i >= 0 && i < result.length) result[i] = Number(row.n);
  }
  return result;
}

type ConversionCounts = {
  converted: number;
  convertedPrevious: number;
  visited: number;
  visitedPrevious: number;
};

/**
 * Convertis and the rate's denominator for both periods, in one statement —
 * docs/api.md › The dashboard defines them.
 *
 * Each row of the inner union is one event: a door-day over both periods
 * (`bothPeriods` is `doorDaysBetween` over `[previousFrom, to)`, served by
 * `visits_visited_idx`) whose latest outcome is `converted` is a conversion and
 * any is a visit; or a prospect whose current status is a
 * manual `converted` set in that range and not since overridden by a visit
 * (served by `prospects_status_idx`).
 * Events are keyed by `PROSPECT_KEY`, so an absorbed prospect
 * counts as its survivor, and `count(distinct …)` counts each place once.
 */
async function conversionCounts(
  db: Db,
  {
    from,
    to,
    previousFrom,
    bothPeriods,
  }: { from: number; to: number; previousFrom: number; bothPeriods: SQL },
): Promise<ConversionCounts> {
  const converted = "converted" satisfies Status;
  const rows = await db.all<Record<keyof ConversionCounts, number | null>>(sql`
    select
      count(distinct case when in_current = 1 and is_conversion = 1 then prospect_key end) as converted,
      count(distinct case when in_current = 0 and is_conversion = 1 then prospect_key end) as convertedPrevious,
      count(distinct case when in_current = 1 and is_visit = 1 then prospect_key end) as visited,
      count(distinct case when in_current = 0 and is_visit = 1 then prospect_key end) as visitedPrevious
    from (
      select
        ${PROSPECT_KEY} as prospect_key,
        dd.visited_at >= ${from} as in_current,
        1 as is_visit,
        dd.outcome = ${converted} as is_conversion
      from (${bothPeriods}) dd
      inner join ${prospects} on ${prospects.id} = dd.prospect_id
      union all
      select ${PROSPECT_KEY}, ${prospects.statusSetAt} >= ${from}, 0, 1
      from ${prospects}
      where ${prospects.status} = ${converted}
        and ${prospects.statusSetAt} >= ${previousFrom}
        and ${prospects.statusSetAt} < ${to}
        -- Still the manual status: a later visit sets status and leaves
        -- status_set_at alone (the complement of visitWins in status.ts).
        and ${MANUAL_STATUS_IN_FORCE}
    )
  `);
  const row = rows[0];
  return {
    converted: Number(row?.converted ?? 0),
    convertedPrevious: Number(row?.convertedPrevious ?? 0),
    visited: Number(row?.visited ?? 0),
    visitedPrevious: Number(row?.visitedPrevious ?? 0),
  };
}

/* ---------------------------------------------------------------- prospects */

/**
 * `q` against the folded name, shared by the list and the export so the two
 * cannot diverge. The needle is folded by the same `foldForSearch` that wrote
 * `name_search`, so accents and case drop out on both sides (ADR-0032).
 *
 * A row not folded yet (`name_search` null until the nightly sweep reaches it)
 * keeps the match it had before: the raw needle against `name`, ASCII case
 * folded by `LIKE` itself. A needle that folds to nothing but spaces —
 * combining marks alone — is matched raw too, rather than as `%%` or `% %`,
 * which would match every row or nearly.
 *
 * `%`, `_` and the escape character itself are all escaped, so each matches
 * literally. That third one is not optional: with `ESCAPE '!'`, a bare `!`
 * before a `%`, a `_` or another `!` starts an escape sequence, so a name like
 * "Chez Paul!" would become unsearchable. Do not narrow that character class.
 *
 * `!` is the escape character rather than the conventional `\` because getting
 * a lone backslash through the JS string literal and into the statement proved
 * error-prone; `!` carries no such trap and is not a `LIKE` metacharacter.
 */
function nameSearchFilter(q: string) {
  const pattern = (needle: string) => `%${needle.replace(/[!%_]/g, (ch) => `!${ch}`)}%`;
  const raw = sql`${prospects.name} LIKE ${pattern(q)} ESCAPE '!'`;
  const folded = foldForSearch(q);
  if (!folded.trim()) return raw;
  return sql`(${prospects.nameSearch} LIKE ${pattern(folded)} ESCAPE '!'
    or (${prospects.nameSearch} is null and ${raw}))`;
}

/**
 * "Hors cible signalé" (prospecting.md): the prospect's latest visit carries
 * `out_of_target` and no admin edit has stamped `out_of_target_reviewed_at`
 * after it. "Latest" orders as `deriveProspectStatus` does. The flag never
 * reads `updated_at`, which assign, merge and import also move. The subselect
 * walks `visits_prospect_visited_idx`, and `last_visit_at is not null` prunes
 * prospects that were never visited before it runs.
 */
const OUT_OF_TARGET_FLAGGED = sql`(
  ${prospects.lastVisitAt} is not null
  and exists (
    select 1 from ${visits}
    where ${visits.id} = (
      select v.id from visits v
      where v.prospect_id = ${prospects.id}
      order by v.visited_at desc, v.received_at desc, v.id desc
      limit 1
    )
    and ${visits.refusalReason} = 'out_of_target'
    and (${prospects.outOfTargetReviewedAt} is null or ${prospects.outOfTargetReviewedAt} <= ${visits.visitedAt})
  )
)`;

/**
 * "Sans agent actif" (docs/api.md › The dashboard): assigned to an email with
 * no active `users` row, so a deactivated user and an address left from the
 * allow-lists both count. Shared by the dashboard's `inactiveAgentProspects`
 * and `prospectFilters`, so the figure and the list cannot diverge. The
 * subselect is a primary-key lookup on `users.email`.
 */
const NO_ACTIVE_AGENT = sql`(
  ${prospects.assignedTo} is not null
  and not exists (
    select 1 from ${users}
    where ${users.email} = ${prospects.assignedTo} and ${users.active} = 1
  )
)`;

/**
 * The `SQL[]` for `prospectFiltersSchema` (src/shared/schemas.ts), shared by
 * the list and the export so a filter added to one is never forgotten on the
 * other (Intent: "so the two cannot diverge").
 */
function prospectFilters(query: {
  status?: Status[];
  dueBefore?: number;
  assignedTo?: string | null;
  source?: Source;
  q?: string;
  outOfTarget?: "true";
  inactiveAgent?: "true";
}): SQL[] {
  const { status, dueBefore, assignedTo, source, q, outOfTarget, inactiveAgent } = query;
  return [
    // A merged prospect is not a row the admin manages any more.
    isNull(prospects.mergedInto),
    status ? inArray(prospects.status, status) : undefined,
    // Relances dues' definition (the dashboard's followUpsDue): a null
    // next_visit_at compares as unknown in SQL, so it is never due.
    dueBefore !== undefined ? lt(prospects.nextVisitAt, dueBefore) : undefined,
    assignedTo ? eq(prospects.assignedTo, assignedTo) : undefined,
    source ? eq(prospects.source, source) : undefined,
    q ? nameSearchFilter(q) : undefined,
    outOfTarget ? OUT_OF_TARGET_FLAGGED : undefined,
    inactiveAgent ? NO_ACTIVE_AGENT : undefined,
  ].filter((f) => f !== undefined);
}

adminRoutes.get("/prospects", validate("query", prospectsQuerySchema), async (c) => {
  const { limit, offset, ...filters } = c.req.valid("query");
  const db = getDb(c.env.DB);

  const where = and(...prospectFilters(filters));

  const rows = await db
    .select()
    .from(prospects)
    .where(where)
    // A tiebreaker: a batch import stamps one identical updated_at on every
    // row, so without it which rows land on which page — and which survive
    // the export's cap — would be undefined.
    .orderBy(desc(prospects.updatedAt), asc(prospects.id))
    .limit(limit)
    .offset(offset);

  const [totals] = await db.select({ total: count() }).from(prospects).where(where);

  return c.json<ProspectsResponse>({
    prospects: rows.map(toWireProspect),
    total: totals?.total ?? 0,
  });
});

/**
 * Import. Upsert by dedupe key, so re-importing a corrected spreadsheet updates
 * in place instead of duplicating — the thing the spreadsheet workflow cannot do.
 *
 * Only descriptive fields are updated. Status, assignment and visit history are
 * never touched by an import (prospecting.md).
 */
adminRoutes.post("/prospects/batch", validate("json", prospectBatchSchema), async (c) => {
  const { source, rows: incoming, importLog } = c.req.valid("json");
  const { email } = c.get("identity");
  const db = getDb(c.env.DB);
  const now = Date.now();

  /**
   * Collapse duplicates within the request first. SQLite refuses an
   * ON CONFLICT DO UPDATE that would touch the same row twice in one statement
   * ("cannot affect row a second time") and would fail the whole chunk, so two
   * spreadsheet lines for the same place must become one row here. Last wins.
   */
  const byKey = new Map<string, NewProspectRow>();
  for (const row of incoming) {
    const key = dedupeKey({
      name: row.name,
      sourceRef: row.sourceRef,
      lat: row.lat,
      lng: row.lng,
      address: row.address,
    });
    byKey.set(key, {
      id: crypto.randomUUID(),
      name: row.name,
      nameSearch: foldForSearch(row.name),
      type: row.type,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      address: row.address ?? null,
      phone: row.phone ?? null,
      website: row.website ?? null,
      cuisine: row.cuisine ?? null,
      source,
      sourceRef: row.sourceRef ?? null,
      dedupeKey: key,
      status: "new",
      assignedTo: null,
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    });
  }

  let created = 0;
  let updated = 0;

  /**
   * A merged prospect keeps its dedupe key, so re-importing the spelling it was
   * filed under still lands on it. Redirect those rows to the survivor, or the
   * import would quietly update a prospect the admin has already retired and
   * the live one would never see the new data.
   */
  const survivorByKey = new Map<string, string>();
  for (const keyBatch of chunk([...byKey.keys()], 2)) {
    const merged = await db
      .select({ dedupeKey: prospects.dedupeKey, mergedInto: prospects.mergedInto })
      .from(prospects)
      .where(and(inArray(prospects.dedupeKey, keyBatch), isNotNull(prospects.mergedInto)));
    for (const row of merged) {
      if (row.mergedInto) survivorByKey.set(row.dedupeKey, row.mergedInto);
    }
  }

  for (const [key, survivorId] of survivorByKey) {
    const row = byKey.get(key);
    byKey.delete(key);
    if (!row) continue;

    /**
     * Same "only overwrite what the import carries" rule as the upsert below,
     * with one addition: the name is left alone.
     *
     * We are here because the admin merged the spelling this row is filed under
     * into the survivor, which is a deliberate and more recent statement about
     * what this place is called than an old spreadsheet is. Writing the name
     * would rename the survivor back, restore its stale dedupe key, and have
     * the next import create the duplicate all over again.
     */
    const [touched] = await db
      .update(prospects)
      .set({
        type: row.type,
        lat: row.lat ?? sql`${prospects.lat}`,
        lng: row.lng ?? sql`${prospects.lng}`,
        address: row.address ?? sql`${prospects.address}`,
        phone: row.phone ?? sql`${prospects.phone}`,
        website: row.website ?? sql`${prospects.website}`,
        cuisine: row.cuisine ?? sql`${prospects.cuisine}`,
        updatedAt: now,
      })
      .where(and(eq(prospects.id, survivorId), isNull(prospects.mergedInto)))
      .returning({ id: prospects.id });
    if (touched) updated += 1;
  }

  for (const batch of chunk([...byKey.values()], boundParamsPerRow(prospects))) {
    const written = await db
      .insert(prospects)
      .values(batch)
      .onConflictDoUpdate({
        target: prospects.dedupeKey,
        /**
         * An import overwrites a field only when it carries a value for it.
         *
         * Without the coalesce, a CSV whose phone column is unmapped — which
         * the column-mapping step makes a one-click mistake — would send null
         * for every row and silently erase every phone number we had. The
         * spreadsheet is authoritative about what it says, not about what it
         * leaves out. Clearing a field on purpose is what PATCH is for.
         *
         * `name` and `type` are always written: name is required by the
         * schema, and type carries its own default, so neither can arrive
         * empty to mean "unchanged".
         */
        set: {
          name: sql`excluded.name`,
          nameSearch: sql`excluded.name_search`,
          type: sql`excluded.type`,
          lat: sql`coalesce(excluded.lat, ${prospects.lat})`,
          lng: sql`coalesce(excluded.lng, ${prospects.lng})`,
          address: sql`coalesce(excluded.address, ${prospects.address})`,
          phone: sql`coalesce(excluded.phone, ${prospects.phone})`,
          website: sql`coalesce(excluded.website, ${prospects.website})`,
          cuisine: sql`coalesce(excluded.cuisine, ${prospects.cuisine})`,
          sourceRef: sql`coalesce(excluded.source_ref, ${prospects.sourceRef})`,
          updatedAt: now,
        },
      })
      .returning({ id: prospects.id });

    // An insert keeps the id we generated for it; a conflict returns the id of
    // the row that already existed. Comparing ids is exact, where comparing
    // timestamps would miscount a row written in this same millisecond.
    const proposed = new Set(batch.map((row) => row.id));
    for (const row of written) {
      if (proposed.has(row.id)) created += 1;
      else updated += 1;
    }
  }

  // After the prospects, so a failure here fails the request and the client
  // re-sends; the upsert above is idempotent (ADR-0030).
  if (importLog) {
    await writeImportLog(db, { log: importLog, source, createdBy: email, created, updated, now });
  }

  return c.json<ImportResult>({ created, updated });
});

/** The five newest settled imports for the Import screen (ADR-0030). */
adminRoutes.get("/imports", async (c) => {
  const db = getDb(c.env.DB);
  return c.json<ImportsResponse>({ imports: await listImports(db, Date.now()) });
});

/**
 * Both exports fetch one row over `EXPORT_ROWS`, so "was there more?" needs no
 * second COUNT query: D1 bills rows scanned, and the answer is one row's worth
 * of scan (docs/api.md › CSV exports).
 */
function capExport<T>(rows: T[]): { page: T[]; truncated: boolean } {
  const truncated = rows.length > EXPORT_ROWS;
  return { page: truncated ? rows.slice(0, EXPORT_ROWS) : rows, truncated };
}

function csvResponse(body: string, prefix: string, now: number, truncated: boolean): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": csvDisposition(csvFilename(prefix, now)),
      ...(truncated ? { "x-truncated": "true" } : {}),
    },
  });
}

/**
 * The prospect ledger as a CSV file.
 *
 * Registered **above** `/prospects/:id`, so the literal path is never read as
 * an id. Filtered exactly as the list screen filters, reusing its schema's
 * enums — an export that filtered differently from the screen it was launched
 * from would be a quiet lie.
 *
 * Merged prospects are excluded like every other list: the survivor is the row
 * that still means something (prospecting.md).
 */
adminRoutes.get(
  "/prospects/export.csv",
  validate("query", prospectsExportQuerySchema),
  async (c) => {
    const db = getDb(c.env.DB);
    const now = Date.now();

    const filters = prospectFilters(c.req.valid("query"));

    // One row over the cap: see `capExport`.
    const rows = await db
      .select()
      .from(prospects)
      .where(and(...filters))
      // Same tiebreak as the list, and for the same reason: without it, which
      // rows land inside the cap is undefined when many share an updated_at.
      .orderBy(desc(prospects.updatedAt), asc(prospects.id))
      .limit(EXPORT_ROWS + 1);

    const { page, truncated } = capExport(rows);

    // snake_case like the columns, not the wire's camelCase: the reader here is
    // a spreadsheet and whoever opens it, not the client.
    const body = csvFile(
      [
        "name",
        "type",
        "address",
        "phone",
        "website",
        "cuisine",
        "status",
        "assigned_to",
        "source",
        "lat",
        "lng",
        "last_visit_at",
        "next_visit_at",
      ],
      page.map((p) => [
        p.name,
        p.type,
        p.address,
        p.phone,
        p.website,
        p.cuisine,
        p.status,
        p.assignedTo,
        p.source,
        p.lat,
        p.lng,
        csvTimestamp(p.lastVisitAt),
        csvTimestamp(p.nextVisitAt),
      ]),
      CSV_ATTRIBUTION,
    );

    return csvResponse(body, "prospects", now, truncated);
  },
);

/**
 * Admin edit. `status` is accepted here (prospecting.md: an admin may reopen or
 * close a prospect by hand); INVARIANT 3 still holds, because no client ever
 * sends a status *derived from a visit*.
 *
 * The dedupe key is deliberately not recomputed when the name or address
 * changes: it is import-time identity, and recomputing could collide with the
 * unique index and fail an otherwise valid edit.
 */
adminRoutes.patch(
  "/prospects/:id",
  validate("param", prospectIdParamSchema),
  validate("json", prospectPatchSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const patch = c.req.valid("json");

    if (
      patch.assignedTo !== undefined &&
      (await unknownAssignee(patch.assignedTo, getDb(c.env.DB)))
    ) {
      return c.json(
        { error: "unknown_assignee", message: "Cette adresse ne figure pas parmi les agents." },
        400,
      );
    }

    const db = getDb(c.env.DB);
    const now = Date.now();

    // A status set here holds against any visit dated at or before now, however
    // late that visit syncs (ADR-0025). Any direct edit is also the admin's
    // review of a Hors cible flag: this is the only writer of the column.
    const [row] = await db
      .update(prospects)
      .set({
        ...patch,
        ...(patch.name !== undefined && { nameSearch: foldForSearch(patch.name) }),
        ...(patch.status !== undefined && { statusSetAt: now }),
        outOfTargetReviewedAt: now,
        updatedAt: now,
      })
      .where(eq(prospects.id, id))
      .returning();

    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(toWireProspect(row));
  },
);

/**
 * Bulk assign, and bulk unassign with `assignedTo: null`.
 *
 * Status moves only along the two edges prospecting.md allows: new → assigned
 * on assignment, assigned → new on unassignment. A prospect that has been
 * visited (follow_up, interested, converted, rejected) keeps the status its
 * visits earned.
 */
adminRoutes.post("/prospects/assign", validate("json", assignSchema), async (c) => {
  const { ids, assignedTo } = c.req.valid("json");

  if (await unknownAssignee(assignedTo, getDb(c.env.DB))) {
    return c.json(
      { error: "unknown_assignee", message: "Cette adresse ne figure pas parmi les agents." },
      400,
    );
  }

  const db = getDb(c.env.DB);
  const now = Date.now();

  // Each id binds one parameter and the SET clause binds a few more, so we ask
  // for half of D1's budget rather than counting them by hand (INVARIANT 7).
  const batches = chunk([...new Set(ids)], 2);
  let assigned = 0;

  for (const batch of batches) {
    const touched = await db
      .update(prospects)
      .set({ assignedTo, updatedAt: now })
      .where(inArray(prospects.id, batch))
      .returning({ id: prospects.id });
    assigned += touched.length;

    await db
      .update(prospects)
      .set({ status: assignedTo ? "assigned" : "new", updatedAt: now })
      .where(
        and(inArray(prospects.id, batch), eq(prospects.status, assignedTo ? "new" : "assigned")),
      );
  }

  return c.json<AssignResult>({ assigned });
});

/* ---------------------------------------------------------------- merging */

/** Null when either side has no coordinates; the UI shows a dash, not a zero. */
function metresBetween(a: ProspectRow, b: ProspectRow): number | null {
  if (typeof a.lat !== "number" || typeof a.lng !== "number") return null;
  if (typeof b.lat !== "number" || typeof b.lng !== "number") return null;
  return Math.round(distanceMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }));
}

/**
 * Candidate duplicates: two live prospects that are probably one place.
 *
 * The dedupe key cannot catch these, because tiers 2 and 3 are built from the
 * name — rename a prospect between imports and it gets a new key and a new row
 * (prospecting.md). This finds those pairs again.
 *
 * Comparing every pair would be quadratic and this runs inside a 10 ms CPU
 * budget, so prospects are bucketed into ~110 m cells first and each one is
 * only compared against its own cell and the eight around it. The radius that
 * counts as "same place" is 50 m, so nothing within range falls outside.
 */
adminRoutes.get("/prospects/duplicates", async (c) => {
  const db = getDb(c.env.DB);

  const rows = await db
    .select()
    .from(prospects)
    .where(isNull(prospects.mergedInto))
    .orderBy(desc(prospects.updatedAt))
    .limit(DUPLICATES_SCAN_LIMIT + 1);

  const truncated = rows.length > DUPLICATES_SCAN_LIMIT;
  const scanned = truncated ? rows.slice(0, DUPLICATES_SCAN_LIMIT) : rows;

  const buckets = new Map<string, ProspectRow[]>();
  const put = (key: string, row: ProspectRow) => {
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  };

  for (const row of scanned) {
    if (typeof row.lat === "number" && typeof row.lng === "number") {
      put(cellOf({ lat: row.lat, lng: row.lng }), row);
    } else {
      // No coordinates: the name is all there is, so bucket by that instead.
      put(`name:${normalize(row.name)}`, row);
    }
  }

  const pairs: { a: ProspectRow; b: ProspectRow; distanceM: number | null }[] = [];
  const seen = new Set<string>();

  for (const row of scanned) {
    const neighbourhood: ProspectRow[] = [];
    if (typeof row.lat === "number" && typeof row.lng === "number") {
      for (const cell of cellAndNeighbours({ lat: row.lat, lng: row.lng })) {
        neighbourhood.push(...(buckets.get(cell) ?? []));
      }
    } else {
      neighbourhood.push(...(buckets.get(`name:${normalize(row.name)}`) ?? []));
    }

    for (const other of neighbourhood) {
      if (other.id === row.id) continue;
      const pairKey = row.id < other.id ? `${row.id}|${other.id}` : `${other.id}|${row.id}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      if (!isProbablySamePlace(row, other)) continue;
      pairs.push({ a: row, b: other, distanceM: metresBetween(row, other) });
      if (pairs.length >= DUPLICATES_PAGE_SIZE) break;
    }
    if (pairs.length >= DUPLICATES_PAGE_SIZE) break;
  }

  // Visit counts, so the admin chooses between two known things rather than
  // guessing which side carries the history.
  const ids = [...new Set(pairs.flatMap((p) => [p.a.id, p.b.id]))];
  const counts = new Map<string, number>();
  for (const batch of chunk(ids, 2)) {
    const rows = await db
      .select({ prospectId: visits.prospectId, n: count() })
      .from(visits)
      .where(inArray(visits.prospectId, batch))
      .groupBy(visits.prospectId);
    for (const row of rows) counts.set(row.prospectId, row.n);
  }

  return c.json<DuplicatesResponse>({
    truncated,
    pairs: pairs.map((p) => ({
      a: toWireProspect(p.a),
      b: toWireProspect(p.b),
      distanceM: p.distanceM,
      aVisits: counts.get(p.a.id) ?? 0,
      bVisits: counts.get(p.b.id) ?? 0,
    })),
  });
});

/**
 * Merge one prospect into another. Soft, and therefore reversible.
 *
 * Nothing is deleted and no visit is repointed — visits are append-only. The
 * absorbed prospect keeps everything it had and simply stops being live, so an
 * admin who merges the wrong pair can undo it.
 *
 * The survivor keeps its own status and assignment: status is derived from its
 * own visits (INVARIANT 3), and the loser's visits stay on the loser.
 */
adminRoutes.post("/prospects/merge", validate("json", mergeSchema), async (c) => {
  const { survivorId, mergedId } = c.req.valid("json");
  const db = getDb(c.env.DB);

  const found = await db
    .select()
    .from(prospects)
    .where(inArray(prospects.id, [survivorId, mergedId]));
  const survivor = found.find((r) => r.id === survivorId);
  const merged = found.find((r) => r.id === mergedId);

  if (!survivor || !merged) return c.json({ error: "not_found" }, 404);

  // INVARIANT 4: repeating a merge is a no-op, not an error.
  if (merged.mergedInto === survivorId) {
    return c.json<MergeResult>({ survivorId, mergedId, dedupeKeyUpdated: false });
  }
  if (survivor.mergedInto !== null || merged.mergedInto !== null) {
    return c.json(
      {
        error: "already_merged",
        message: "Un de ces prospects a déjà été fusionné. Annulez la fusion d'abord.",
      },
      400,
    );
  }

  /**
   * Recompute the survivor's key from its current fields, so the next import of
   * the corrected name matches it silently instead of creating this duplicate
   * all over again. If that key already belongs to another live prospect, keep
   * the old one and say so — that collision is another merge, not an error.
   */
  const desiredKey = dedupeKey({
    name: survivor.name,
    sourceRef: survivor.sourceRef,
    lat: survivor.lat,
    lng: survivor.lng,
    address: survivor.address,
  });
  let dedupeKeyUpdated = false;
  if (desiredKey !== survivor.dedupeKey) {
    const [taken] = await db
      .select({ id: prospects.id })
      .from(prospects)
      .where(and(eq(prospects.dedupeKey, desiredKey), ne(prospects.id, survivorId)))
      .limit(1);
    dedupeKeyUpdated = !taken;
  }

  const now = Date.now();
  await db
    .update(prospects)
    .set({ mergedInto: survivorId, updatedAt: now })
    .where(eq(prospects.id, mergedId));

  if (dedupeKeyUpdated) {
    await db
      .update(prospects)
      .set({ dedupeKey: desiredKey, updatedAt: now })
      .where(eq(prospects.id, survivorId));
  }

  return c.json<MergeResult>({ survivorId, mergedId, dedupeKeyUpdated });
});

/** Undo a merge. The absorbed prospect returns to the list with its visits. */
adminRoutes.post("/prospects/:id/unmerge", validate("param", prospectIdParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env.DB);

  const [row] = await db
    .update(prospects)
    .set({ mergedInto: null, updatedAt: Date.now() })
    .where(eq(prospects.id, id))
    .returning();

  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(toWireProspect(row));
});

/* ------------------------------------------------------------------- scripts */

/**
 * Every version, newest first — docs/domains/scripts.md.
 *
 * Old versions are kept and listed: a visit records the `script_id` it was
 * answered with, so reading historical answers means reading the version that
 * was active at the time.
 */
adminRoutes.get("/scripts", async (c) => {
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(scripts)
    .orderBy(desc(scripts.createdAt), desc(scripts.id))
    .limit(SCRIPTS_PAGE_SIZE);

  return c.json<ScriptsResponse>({ scripts: rows.map(toWireScript) });
});

/**
 * Save a script: write version N+1 of that name and make it the active one.
 *
 * Editing never updates a row. An answer is only interpretable against the
 * questions it was asked from, and `visits.script_id` points at a specific
 * version, so changing one in place would silently rewrite history
 * (docs/domains/scripts.md, docs/data-model.md).
 */
adminRoutes.post("/scripts", validate("json", scriptCreateSchema), async (c) => {
  const { name, questions } = c.req.valid("json");
  const db = getDb(c.env.DB);

  const [latest] = await db
    .select({ version: scripts.version })
    .from(scripts)
    .where(eq(scripts.name, name))
    .orderBy(desc(scripts.version))
    .limit(1);

  // D1 has no interactive transaction. A batch is one atomic unit, which is
  // what keeps "exactly one active script" true between these two statements —
  // and `scripts_one_active_idx` refuses the write outright if it ever is not.
  const [, inserted] = await db.batch([
    db.update(scripts).set({ isActive: false }).where(eq(scripts.isActive, true)),
    db
      .insert(scripts)
      .values({
        name,
        version: (latest?.version ?? 0) + 1,
        questions,
        isActive: true,
        createdAt: Date.now(),
      })
      .returning(),
  ]);

  const row = inserted[0];
  if (!row) return c.json({ error: "internal" }, 500);
  return c.json<Script>(toWireScript(row), 201);
});

/* ------------------------------------------------------------- map import */

/**
 * Find places inside a polygon — ADR-0008, docs/domains/ingestion.md.
 *
 * Nothing is written to `prospects` here: this returns candidates, the admin
 * previews them, and the existing `POST /prospects/batch` does the importing.
 * One pipeline, two sources.
 *
 * The browser never calls Overpass itself (INVARIANT 11). Routing it through
 * the Worker is what makes the cache — and therefore the etiquette owed to a
 * donated public service — possible at all.
 */
adminRoutes.post("/import/overpass", validate("json", overpassImportSchema), async (c) => {
  const { polygon } = c.req.valid("json");
  const db = getDb(c.env.DB);

  const hash = await polygonHash(polygon);
  const hit = await readMapCache(db, hash, OVERPASS_CACHE_TTL_MS, toCandidates);
  if (hit) {
    const candidates = await markLikelyDuplicates(db, hit.mapped.candidates);
    return c.json<AreaSearchResponse>({
      ...hit.mapped,
      candidates,
      cached: true,
      cachedAt: hit.cachedAt,
    });
  }

  let response: Response;
  try {
    response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": OVERPASS_USER_AGENT,
      },
      body: `data=${encodeURIComponent(buildOverpassQuery(polygon))}`,
    });
  } catch {
    // No retry loop, here or on the client: Overpass is shared infrastructure
    // and a Worker hammering it is exactly what gets an IP blocked. The screen
    // offers the admin a retry button instead (ADR-0008).
    return c.json(OVERPASS_UNAVAILABLE, 502);
  }

  if (!response.ok) return c.json(OVERPASS_UNAVAILABLE, 502);

  const body = await response.text();
  const mapped = toCandidates(body);
  // Overpass answers a rate limit or an outage with HTML and a 200.
  if (!mapped) return c.json(OVERPASS_UNAVAILABLE, 502);

  await writeMapCache(db, hash, body);

  const candidates = await markLikelyDuplicates(db, mapped.candidates);
  return c.json<AreaSearchResponse>({ ...mapped, candidates, cached: false });
});

/**
 * Find places inside a circle — ADR-0020, docs/domains/ingestion.md.
 *
 * The other provider, deliberately the same route in every way it can be: same
 * cache table, same candidate shape, same preview, nothing written to
 * `prospects` here. A circle rather than a polygon because Nearby Search has no
 * polygon search, and at most 20 results because Google has no page tokens.
 *
 * Two things differ from Overpass and both matter. The key is a secret that
 * must never leave the Worker, which is why this cannot be a browser call at
 * all. And a miss costs money, so the cache here is not politeness — it is the
 * difference between paying once for a circle and paying every time the admin
 * presses the button again.
 */
adminRoutes.post("/import/places", validate("json", placesImportSchema), async (c) => {
  const key = c.env.GOOGLE_PLACES_KEY;
  // Checked before anything else: no key means no search is possible, and
  // answering that without touching D1 or Google is the honest order.
  if (!key) return c.json(PLACES_UNCONFIGURED, 503);

  const { center, radius } = c.req.valid("json");
  const db = getDb(c.env.DB);

  const hash = await circleHash(center, radius);
  const hit = await readMapCache(db, hash, PLACES_CACHE_TTL_MS, toPlaceCandidates);
  if (hit) {
    const candidates = await markLikelyDuplicates(db, hit.mapped.candidates);
    return c.json<AreaSearchResponse>({
      ...hit.mapped,
      candidates,
      cached: true,
      cachedAt: hit.cachedAt,
    });
  }

  let response: Response;
  try {
    response = await fetch(PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // Omitting this is a 400 from Google, and widening it past the Pro
        // fields changes the SKU we are billed at (ADR-0020).
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
      },
      body: buildPlacesBody(center, radius),
    });
  } catch {
    // No retry loop, here or on the client. With Overpass that was etiquette;
    // here a retry is also another billable call, so it stays the admin's
    // decision and the screen offers them the button.
    return c.json(PLACES_UNAVAILABLE, 502);
  }

  // Never surface Google's own body: a 400 from a bad field mask echoes the
  // request back, and the key is in the headers of that request.
  if (!response.ok) return c.json(PLACES_UNAVAILABLE, 502);

  const body = await response.text();
  const mapped = toPlaceCandidates(body);
  if (!mapped) return c.json(PLACES_UNAVAILABLE, 502);

  await writeMapCache(db, hash, body);

  const candidates = await markLikelyDuplicates(db, mapped.candidates);
  return c.json<AreaSearchResponse>({ ...mapped, candidates, cached: false });
});

/* ---------------------------------------------------------------- live feed */

/**
 * The export's `reason=` as SQL: the visits that have it. The feed applies the
 * same reason to a door-day's latest visit instead (`doorDaysTouched`, R12).
 */
function refusalReasonFilter(reason: RefusalReason | undefined): SQL | undefined {
  return reason === undefined ? undefined : eq(visits.refusalReason, reason);
}

/**
 * Door-days as they arrive — ADR-0010, ADR-0036 R13, docs/design.md "The live
 * feed": one row per agent, prospect and Brussels day, each carrying its visits.
 *
 * Ordered by the door-day's greatest `received_at`, not `visited_at`: the feed
 * answers "what has reached me", and a phone that synced a three-day-old visit
 * this minute is news. `visits_received_idx` exists for exactly this ordering.
 *
 * `since` is exclusive, so the client can pass back the greatest `receivedAt` it
 * saw and get only the door-days touched since, each whole. Polling every 15 s
 * makes that the difference between 500 rows and none.
 *
 * Deliberately NOT filtered on `merged_into IS NULL`, which every other admin
 * list does. This one records what agents did, and an absorbed prospect keeps
 * its own visits (docs/domains/prospecting.md): no visit is ever repointed, so
 * filtering here would make a visit vanish from the feed because an admin
 * merged a duplicate afterwards. The name shown is the one the visit was
 * actually made against.
 */
adminRoutes.get("/visits", validate("query", visitsSinceQuerySchema), async (c) => {
  const { since, from, to, reason, limit } = c.req.valid("query");
  const { doorDays, truncated } = await doorDaysTouched(getDb(c.env.DB), {
    since,
    from,
    to,
    reason,
    limit,
  });
  return c.json<AdminVisitsResponse>({ doorDays, truncated, serverTime: Date.now() });
});

/**
 * Visits as a CSV file, for a date range.
 *
 * Filtered on `received_at`, not `visited_at` (INVARIANT 12). A phone can sync
 * days late, and a range read against the phone's clock would silently drop
 * exactly those visits — the ones most worth looking at.
 *
 * Registered above `/visits/orphaned` and `/visits/:id`-shaped routes for the
 * same reason the prospect export is: a literal path must never be read as an
 * id. Joined to prospects for the name, and NOT filtered on `merged_into`,
 * matching the live feed — this records what agents did, and an absorbed
 * prospect keeps its visits. `reason` narrows it exactly as it narrows the feed.
 */
adminRoutes.get("/visits/export.csv", validate("query", visitsExportQuerySchema), async (c) => {
  const { from, to, reason } = c.req.valid("query");
  const db = getDb(c.env.DB);
  const now = Date.now();

  const rows = await db
    .select({
      visitedAt: visits.visitedAt,
      receivedAt: visits.receivedAt,
      agentEmail: visits.agentEmail,
      prospectName: prospects.name,
      outcome: visits.outcome,
      refusalReason: visits.refusalReason,
      flyerGiven: visits.flyerGiven,
      followUpAt: visits.followUpAt,
      notes: visits.notes,
    })
    .from(visits)
    .innerJoin(prospects, eq(visits.prospectId, prospects.id))
    .where(
      and(gte(visits.receivedAt, from), lte(visits.receivedAt, to), refusalReasonFilter(reason)),
    )
    .orderBy(desc(visits.receivedAt))
    .limit(EXPORT_ROWS + 1);

  const { page, truncated } = capExport(rows);

  const body = csvFile(
    [
      "visited_at",
      "received_at",
      "agent_email",
      "prospect_name",
      "outcome",
      "refusal_reason",
      "flyer_given",
      "follow_up_at",
      "notes",
    ],
    page.map((v) => [
      csvTimestamp(v.visitedAt),
      csvTimestamp(v.receivedAt),
      v.agentEmail,
      v.prospectName,
      v.outcome,
      v.refusalReason,
      v.flyerGiven,
      csvTimestamp(v.followUpAt),
      // Free text typed outdoors: commas, quotes and newlines all turn up, and
      // csvField is what keeps such a note inside one record.
      v.notes,
    ]),
    CSV_ATTRIBUTION,
  );

  return csvResponse(body, "visits", now, truncated);
});

/* ------------------------------------------------- orphan repairs (ADR-0022) */

/**
 * The repair queue: visits the server took but could not place.
 *
 * Two reasons land a visit here (ADR-0022): its prospect does not exist, or it
 * belongs to another agent. Either way the phone has already been told the
 * visit is `accepted` and has dropped it, so this table is now the only copy —
 * which is why nothing in here is ever deleted except by an explicit admin act.
 *
 * Ordered newest first. An empty queue is the healthy state, so `remaining` is
 * a smoke alarm rather than a paging cursor: if it is ever non-zero, the answer
 * is upstream, not a bigger page.
 */
adminRoutes.get("/visits/orphaned", async (c) => {
  const db = getDb(c.env.DB);

  const held = await db
    .select()
    .from(visitsOrphaned)
    .orderBy(desc(visitsOrphaned.quarantinedAt))
    .limit(ORPHANS_PAGE_SIZE);

  const [tally] = await db.select({ total: count() }).from(visitsOrphaned);
  const remaining = Math.max(0, (tally?.total ?? 0) - held.length);

  // Candidates are drawn from every live prospect, scored in memory. The queue
  // is small by nature, but this is still a scan per request, so it is bounded
  // by the same DUPLICATES_SCAN_LIMIT the duplicate sweep uses — D1 bills rows
  // read, and an unbounded scan here would be the expensive page in the app.
  const live = held.length
    ? await db
        .select({
          id: prospects.id,
          name: prospects.name,
          address: prospects.address,
          status: prospects.status,
          assignedTo: prospects.assignedTo,
          lat: prospects.lat,
          lng: prospects.lng,
        })
        .from(prospects)
        .where(isNull(prospects.mergedInto))
        .limit(DUPLICATES_SCAN_LIMIT)
    : [];
  const byId = new Map(live.map((p) => [p.id, p]));

  const visitsOut: OrphanedVisit[] = held.map((row) => {
    const named = byId.get(row.prospectId);

    // Nearest first, and only when the visit recorded where it happened. A
    // visit with no position offers no evidence, and ranking a list in
    // arbitrary order would be worse than offering nothing.
    const at =
      typeof row.lat === "number" && typeof row.lng === "number"
        ? { lat: row.lat, lng: row.lng }
        : null;
    const candidates: OrphanCandidate[] = at
      ? live
          .flatMap((p) =>
            typeof p.lat === "number" && typeof p.lng === "number"
              ? [{ p, d: Math.round(distanceMeters(at, { lat: p.lat, lng: p.lng })) }]
              : [],
          )
          .sort((a, b) => a.d - b.d)
          .slice(0, ORPHAN_CANDIDATES)
          .map(({ p, d }) => ({
            id: p.id,
            name: p.name,
            address: p.address,
            status: p.status,
            assignedTo: p.assignedTo,
            distanceM: d,
          }))
      : [];

    return {
      id: row.id,
      prospectId: row.prospectId,
      agentEmail: row.agentEmail,
      visitedAt: row.visitedAt,
      receivedAt: row.receivedAt,
      quarantinedAt: row.quarantinedAt,
      reason: row.reason,
      flyerGiven: row.flyerGiven,
      outcome: row.outcome,
      followUpAt: row.followUpAt,
      notes: row.notes,
      prospectName: named?.name ?? null,
      hasPosition: at !== null,
      candidates,
    };
  });

  const response: OrphansResponse = { visits: visitsOut, remaining };
  return c.json(response);
});

/**
 * Attach a quarantined visit to a prospect and let it count.
 *
 * One endpoint covers both reasons, because they differ only in which id the
 * admin sends: a `not_assigned` row is approved by repairing it against the
 * prospect it already named, an `unknown_prospect` row by choosing one.
 *
 * The visit keeps its original id, so a phone that somehow still holds the row
 * and resends it hits `onConflictDoNothing` and changes nothing (INVARIANT 4).
 */
adminRoutes.post(
  "/visits/orphaned/:id/repair",
  validate("param", visitIdParamSchema),
  validate("json", orphanRepairSchema),
  async (c) => {
    const db = getDb(c.env.DB);
    const { id } = c.req.valid("param");
    const { prospectId } = c.req.valid("json");
    const now = Date.now();

    const [held] = await db.select().from(visitsOrphaned).where(eq(visitsOrphaned.id, id)).limit(1);

    if (!held) {
      // Already repaired is a replay, not an error — the same reading merge
      // takes (INVARIANT 4). Distinguish it from an id that never existed.
      // Report where the visit actually is, not where this request aims.
      const [already] = await db
        .select({ prospectId: visits.prospectId })
        .from(visits)
        .where(eq(visits.id, id));
      if (already) {
        const result: OrphanRepairResult = {
          visitId: id,
          prospectId: already.prospectId,
          repaired: false,
        };
        return c.json(result);
      }
      return c.json({ error: "not_found" }, 404);
    }

    const [target] = await db
      .select({ id: prospects.id, mergedInto: prospects.mergedInto })
      .from(prospects)
      .where(eq(prospects.id, prospectId))
      .limit(1);
    if (!target) {
      return c.json(
        { error: "unknown_prospect", message: "Ce prospect n'existe pas ou a été supprimé." },
        400,
      );
    }

    // Follow a merge, exactly as sync does for a dedupe collision. A prospect
    // can be absorbed in the window between a visit being quarantined and an
    // admin repairing it, and attaching the visit to the retired row would pile
    // it up on a prospect nobody looks at any more. The response reports where
    // it actually landed, so the screen is not left claiming otherwise.
    const attachTo = target.mergedInto ?? target.id;

    // The same reason sync nulls an unknown script id rather than refusing the
    // visit: the answers are still true, and a stale questionnaire reference is
    // not worth losing them over.
    let scriptId = held.scriptId;
    if (typeof scriptId === "number") {
      const [known] = await db
        .select({ id: scripts.id })
        .from(scripts)
        .where(eq(scripts.id, scriptId))
        .limit(1);
      if (!known) scriptId = null;
    }

    // D1 has no interactive transaction; a batch is one atomic unit, which is
    // what stops a crash between these two statements leaving the visit in both
    // tables or in neither.
    await db.batch([
      db
        .insert(visits)
        .values({
          id: held.id,
          prospectId: attachTo,
          agentEmail: held.agentEmail,
          // Already clamped when it was quarantined (INVARIANT 12); clamping
          // again against today's clock would rewrite history at repair time.
          visitedAt: held.visitedAt,
          clientVisitedAt: held.clientVisitedAt,
          receivedAt: held.receivedAt,
          lat: held.lat,
          lng: held.lng,
          flyerGiven: held.flyerGiven,
          outcome: held.outcome,
          followUpAt: held.followUpAt,
          refusalReason: held.refusalReason,
          notes: held.notes,
          scriptId,
          answers: held.answers,
          clientVersion: held.clientVersion,
        })
        .onConflictDoNothing(),
      db.delete(visitsOrphaned).where(eq(visitsOrphaned.id, id)),
    ]);

    await deriveProspectStatus(db, [attachTo], now);

    const result: OrphanRepairResult = { visitId: id, prospectId: attachTo, repaired: true };
    return c.json(result);
  },
);

/**
 * Drop a quarantined visit for good.
 *
 * This is the one place the app deletes a visit, and it is deliberate: a row
 * whose prospect genuinely no longer exists has nowhere to go, and a queue that
 * can only grow is a queue nobody reads. INVARIANT 5 is written against
 * *silent* loss — an admin choosing this, behind a confirmation, is the
 * opposite of that. It is idempotent: discarding twice is a no-op, not a 404.
 */
adminRoutes.post(
  "/visits/orphaned/:id/discard",
  validate("param", visitIdParamSchema),
  async (c) => {
    const db = getDb(c.env.DB);
    const { id } = c.req.valid("param");
    await db.delete(visitsOrphaned).where(eq(visitsOrphaned.id, id));
    return c.json({ discarded: id });
  },
);
