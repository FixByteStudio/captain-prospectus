/**
 * Shared constants and domain enums.
 *
 * Pure module: no DOM, no Worker APIs (CLAUDE.md). Both sides import from here;
 * the values below are the ones the domain docs describe, and the docs win.
 */

export const HOUR_MS = 60 * 60 * 1000;

/** A day in ms. Brussels days are not all this long, which is why `periodOffsets` exists (shared/period.ts). */
export const DAY_MS = 24 * HOUR_MS;

/** The cap on `shortText` and a multi-choice answer in the shared schemas; anything cut to fit one imports it. */
export const SHORT_TEXT_MAX = 200;

/** The cap on `longText` and a text answer: the shared schemas and the answer resolver (answers.ts) must agree. */
export const LONG_TEXT_MAX = 2000;

/** A question's `options`, and so the choices one multi answer can hold. */
export const QUESTION_OPTIONS_MAX = 30;

/** A question's `key`, and so an answer's: answers are keyed by question key. */
export const QUESTION_KEY_MAX = 60;

/** RFC 5321's longest address. */
export const EMAIL_MAX = 320;

/** docs/glossary.md — a prospect's lifecycle. */
export const STATUSES = [
  "new",
  "assigned",
  "follow_up",
  "interested",
  "converted",
  "rejected",
] as const;
export type Status = (typeof STATUSES)[number];

/** docs/glossary.md — the result of one visit. */
export const OUTCOMES = [
  "no_contact",
  "interested",
  "not_interested",
  "follow_up",
  "converted",
] as const;
export type Outcome = (typeof OUTCOMES)[number];

/**
 * À relancer and Personne sur place share the when step (when-step.md,
 * CAP-2); every other result has none. The one home for this rule — the
 * today rule (`today.ts`), the visit draft and `VisitScreen.tsx` all import it
 * rather than restating the outcome list.
 */
export function hasWhenStep(outcome: Outcome): boolean {
  return outcome === "follow_up" || outcome === "no_contact";
}

export const PROSPECT_TYPES = [
  "restaurant",
  "fast_food",
  "cafe",
  "bar",
  "food_truck",
  "other",
] as const;
export type ProspectType = (typeof PROSPECT_TYPES)[number];

/**
 * Where a prospect came from. `osm` and `google` are both the map import, and
 * they stay distinct: they have different licences, different freshness and
 * different `source_ref` formats, and the admin filters on the difference
 * (ADR-0020).
 */
export const SOURCES = ["csv", "osm", "google", "field"] as const;
export type Source = (typeof SOURCES)[number];

export const ROLES = ["admin", "agent"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Why a visit is in `visits_orphaned` rather than `visits` (ADR-0022).
 *
 * The admin screen affords different actions per reason: an `unknown_prospect`
 * row has no target and needs one chosen, a `not_assigned` row already names
 * the prospect and only needs approving.
 */
export const ORPHAN_REASONS = ["unknown_prospect", "not_assigned"] as const;
export type OrphanReason = (typeof ORPHAN_REASONS)[number];

/**
 * docs/domains/prospecting.md — why a `not_interested` visit was refused.
 *
 * Order is display order. Values are stored for ever: never rename or reuse
 * one with another meaning.
 */
export const REFUSAL_REASONS = [
  "too_many_devices",
  "wait_and_see",
  "fee_distrust",
  "no_need",
  "out_of_target",
  "no_reason_given",
  "other",
] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export const QUESTION_TYPES = ["yes_no", "single", "multi", "text", "number", "rating"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * docs/domains/prospecting.md — the status a visit outcome produces.
 *
 * INVARIANT 3: the server computes this. Clients never send a derived status.
 */
export const OUTCOME_TO_STATUS: Readonly<Record<Outcome, Status>> = {
  no_contact: "follow_up",
  // Closed, so an Intéressé lead leaves the round (ADR-0027).
  interested: "interested",
  not_interested: "rejected",
  follow_up: "follow_up",
  converted: "converted",
};

/** Statuses that put a prospect on an agent's today list. */
export const OPEN_STATUSES: readonly Status[] = ["new", "assigned", "follow_up"];

export function isOpen(status: Status): boolean {
  return OPEN_STATUSES.includes(status);
}

/**
 * Sync contract version: docs/domains/field-operations.md "Versioning", and the
 * sync-contract-change skill for how to bump it. Bump CLIENT_VERSION on any
 * breaking change to the /api/agent/sync payload. Once the data stage is protected,
 * raise MIN_CLIENT_VERSION only once every phone reports the new version; while
 * disposable, raise both together (ADR-0033).
 */
export const CLIENT_VERSION = 1;
export const MIN_CLIENT_VERSION = 1;

/**
 * Payload caps.
 *
 * IMPORT_ROWS_PER_REQUEST is set by the Workers Free 10 ms CPU budget, not by
 * payload size: validating and normalising a row costs CPU, waiting on D1 does
 * not. See docs/free-tier-budget.md.
 */
export const IMPORT_ROWS_PER_REQUEST = 250;
export const SYNC_VISITS_PER_REQUEST = 200;
export const SYNC_PROSPECTS_PER_REQUEST = 100;
export const ADMIN_VISITS_PAGE_SIZE = 500;

/** Coarsest fix worth keeping (metres): an IP-based one cannot order a walk (ADR-0028). */
export const AGENT_POSITION_ACCURACY_MAX_M = 10_000;

/**
 * Questions per script, and so answers per visit: a visit answers one script
 * version, once per question (docs/domains/scripts.md). Lowering it would
 * refuse visits already queued on a phone — INVARIANT 9.
 */
export const SCRIPT_QUESTIONS_MAX = 50;

/**
 * Largest request body the Worker will read, in bytes: about twice the largest
 * sync a real client can build. The measurements and the 19.7 MiB schema-valid
 * payload it refuses are in docs/security.md ("The body cap").
 *
 * The client depends on it: sync.ts trims each batch to fit, so a cap below one
 * worst-case visit is a 413 that never drains (INVARIANT 5). The budget tests in
 * constants.test.ts fail when a count cap outgrows it.
 */
export const MAX_REQUEST_BYTES = 2_097_152;

/**
 * Script versions returned by `GET /api/admin/scripts`. Editing a script writes
 * a new row rather than updating one (docs/domains/scripts.md), so this table
 * only ever grows — slowly, by hand, but it grows.
 */
export const SCRIPTS_PAGE_SIZE = 100;

/**
 * The Tableau de bord's period selector, in Brussels calendar days (GH #107).
 * `src/shared/period.ts` turns one into bounds.
 */
export const DASHBOARD_PERIODS = [7, 30, 90] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];
export const DASHBOARD_DEFAULT_PERIOD: DashboardPeriod = 30;

/** Past visits shown on the visit form. Enough context, one D1 page. */
export const VISIT_HISTORY_LIMIT = 20;

/**
 * One page of the admin prospect list. Also the cap: D1's free tier counts
 * *scanned* rows, so an unbounded select over a few thousand prospects is a
 * real cost every time the admin changes a filter.
 */
export const PROSPECTS_PAGE_SIZE = 200;

/**
 * How deep the list can be paged. SQLite walks the index to reach an offset, so
 * an unbounded one is a full scan that returns nothing. 100 pages is far past
 * the few thousand prospects this project plans for (docs/vision.md).
 */
export const PROSPECTS_MAX_OFFSET = PROSPECTS_PAGE_SIZE * 100;

/**
 * The orphan repair queue, and how many prospects it offers per row.
 *
 * A healthy database has an empty queue, so the page size is a safety rail
 * rather than a working limit — if it is ever hit, something is wrong upstream
 * and the number is not what needs raising. The candidate count is small on
 * purpose: the admin is picking the right door from a ranked shortlist, and a
 * long list is a worse decision, not a better-informed one.
 */
export const ORPHANS_PAGE_SIZE = 200;
export const ORPHAN_CANDIDATES = 5;

/** Rows in one CSV export: a CPU cap, not a page (docs/api.md, "CSV exports"). */
export const EXPORT_ROWS = 500;

/** Default window for the visits export: the last 30 days. */
export const EXPORT_DEFAULT_WINDOW_MS = 30 * DAY_MS;

/**
 * How long a visit keeps `lat`, `lng` and `notes`, measured on `received_at`
 * because a phone's clock can be wrong (INVARIANT 12, ADR-0023).
 */
export const RETENTION_DAYS = 90;
export const RETENTION_MS = RETENTION_DAYS * DAY_MS;

/**
 * Rows the sweep redacts per run.
 *
 * The first run after this ships may have a backlog; every run after it matches
 * almost nothing, because a redacted row no longer qualifies. Bounding the
 * statement keeps one cron invocation inside the CPU budget and the D1 daily
 * write quota (INVARIANT 13, docs/free-tier-budget.md), and a backlog simply
 * drains over a few days.
 */
export const RETENTION_BATCH = 500;

/**
 * Expired map-cache rows the daily sweep deletes per run. Once the first run
 * clears the backlog, only a day's worth of new rows expires each day. The
 * bound keeps an unexpected backlog within one cron's CPU and D1's daily write
 * quota, the same as RETENTION_BATCH.
 */
export const MAP_CACHE_EVICT_BATCH = 500;

/**
 * Expired rows the daily sweep deletes from EACH of `login_codes`, `sessions`
 * and `login_attempts` per run. A flood of failed logins can write a day's
 * request quota of attempt rows; one run deleting them all could use the D1
 * write quota, so a backlog drains over a few days (CAP-10).
 */
export const AUTH_SWEEP_BATCH = 500;

/**
 * The import log (ADR-0030). An import with batches missing and none received
 * for this long is read as « Interrompu »; a newer one is still running and is
 * not listed. Read-time only, so changing it needs no migration.
 */
export const IMPORT_STALE_MS = 5 * 60 * 1000;

/** Cap on `importLog.batchCount`: 10 000 batches of 250 rows is 2.5 M rows. */
export const IMPORT_LOG_BATCH_COUNT_MAX = 10_000;

/** Longest `importLog.fileName`: a `shortText` on the wire. */
export const IMPORT_LOG_FILE_NAME_MAX = SHORT_TEXT_MAX;

/** Cap on the log's other counts (`rejected`, zone size); a 250-row batch cannot reach it. */
export const IMPORT_LOG_COUNT_MAX = 10_000_000;

/** `GET /api/admin/imports` reads this many newest imports, settles them, keeps the first few. */
export const IMPORT_LOG_WINDOW = 20;
export const IMPORT_LOG_LIST_SIZE = 5;

/**
 * Import-log rows the daily sweep redacts per run (ADR-0030), for the same
 * reason as RETENTION_BATCH.
 */
export const IMPORT_LOG_SWEEP_BATCH = 500;

/**
 * Prospects the daily sweep gives a `name_search` per run (ADR-0032), for the
 * same reason as RETENTION_BATCH. Only rows written before the column existed,
 * or inserted by the previous Worker during a deploy, are ever null.
 */
export const NAME_SEARCH_FOLD_BATCH = 500;

/** Candidate duplicate pairs returned in one sweep. */
export const DUPLICATES_PAGE_SIZE = 100;

/**
 * Prospects the duplicate sweep will compare in one request.
 *
 * Comparing pairs is CPU (INVARIANT 13). Bucketing by location keeps the
 * comparisons near-linear, but the scan itself still has to be bounded.
 */
export const DUPLICATES_SCAN_LIMIT = 5_000;

/** D1 allows at most 100 bound parameters per statement. See chunk(). */
export const D1_MAX_BOUND_PARAMS = 100;

/** Overpass polygon bounds (docs/domains/ingestion.md). */
export const POLYGON_MIN_VERTICES = 3;
export const POLYGON_MAX_VERTICES = 200;

/**
 * How long an Overpass answer stays good (ADR-0008): politeness to a shared
 * public service (docs/domains/ingestion.md, "Limits and etiquette").
 */
export const OVERPASS_CACHE_TTL_MS = 7 * DAY_MS;

/**
 * Candidates returned from one map import.
 *
 * A CPU cap, not a payload one (INVARIANT 13): `JSON.parse` of the answer and
 * mapping every element's tags cost CPU. A polygon that returns more is one the
 * admin should split anyway, so the response says `truncated`.
 */
export const OVERPASS_CANDIDATES_LIMIT = 1_000;

/* ------------------------------------------------ Google Places (ADR-0020) */

/**
 * The Google provider's circle; why 2 km and not Google's 50 km:
 * docs/domains/ingestion.md, "Limits".
 */
export const PLACES_RADIUS_MIN_M = 50;
export const PLACES_RADIUS_MAX_M = 2_000;

/** Google's own ceiling, not a choice of ours (docs/domains/ingestion.md, "Limits"). */
export const PLACES_MAX_RESULTS = 20;

/**
 * How long a Google answer stays good. Separate from OVERPASS_CACHE_TTL_MS
 * because the reason differs: this one is the bill (ADR-0020). Google's terms
 * cap caching at 30 days (ADR-0020, "Accepted risks", Storage), so it may shrink
 * but must never grow past 30 days.
 */
export const PLACES_CACHE_TTL_MS = 7 * DAY_MS;
