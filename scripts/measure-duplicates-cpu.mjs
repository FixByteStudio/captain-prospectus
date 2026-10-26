/**
 * Measure `GET /api/admin/prospects/duplicates`'s Worker CPU per request, so
 * `doorDayCounts` has a figure (retro 538/6 N8, GH #638, INVARIANT 13).
 *
 * The same shim as measure-dashboard-cpu.mjs (worker-cpu-shim.mjs): the real
 * Worker in Node's V8, D1's own CPU taken out, signed in as production does
 * (a seeded admin `sessions` row, its cookie, `AUTH_PEPPER`, `DEV_USER_EMAIL`
 * unset). The route reads up to `DUPLICATES_SCAN_LIMIT` prospects, pairs the
 * near ones, then `doorDayCounts` reads every visit of every prospect of the
 * page and finds each visit's Brussels day in JS (`Intl`), which is the part
 * the dashboard's figure never covered.
 *
 * It seeds PAIRS pairs of one door each (a prospect and its renamed twin, far
 * from every other pair, so each is a candidate and nothing else is), a full
 * page at the default 100. Two legs alternate over ROUNDS, as #102's
 * before/after does: "without" has no visit, so `doorDayCounts` reads rows
 * for nothing; "with" gives each prospect VISITS visits over VISITS - 1 Brussels days
 * by one agent. The difference between the legs' medians is `doorDayCounts`'
 * own cost (its reads and its `Intl` days; the statements' D1 time is out). Every
 * timed leg must answer 200 and 100% of the pairs, with the door-day counts the
 * seed implies, so a leg that read nothing is never timed by mistake. Local
 * hardware is not Cloudflare's: keep headroom.
 *
 * Usage: pnpm db:migrate:local
 *        node scripts/measure-duplicates-cpu.mjs
 *        (the script seeds its own pairs, in a copy of the local D1)
 * Env:   D1_SQLITE (the local D1 file; found under .wrangler/state),
 *        PAIRS (100, at most DUPLICATES_PAGE_SIZE), VISITS per prospect in the "with" leg (4), DAYS the Brussels days they are spread over (14),
 *        ROUNDS (3), RUNS per leg and round (100), WARMUP (20).
 * Run with `node --expose-gc` to run a minor collection before each request, outside the timing.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MEASURE_PEPPER,
  at,
  buildWorker,
  copyLocalD1,
  d1Shim,
  seedSession,
  timeRequest,
} from "./worker-cpu-shim.mjs";

// Copies of src/shared/constants.ts: this script must not import src/.
const DUPLICATES_PAGE_SIZE = 100; // DUPLICATES_PAGE_SIZE

const PAIRS = Number(process.env.PAIRS ?? DUPLICATES_PAGE_SIZE);
const VISITS = Number(process.env.VISITS ?? 4);
const DAYS = Number(process.env.DAYS ?? 14);
const ROUNDS = Number(process.env.ROUNDS ?? 3);
const RUNS = Number(process.env.RUNS ?? 100);
const WARMUP = Number(process.env.WARMUP ?? 20);
const ADMIN = "admin@example.com";
const AGENT = "agent@example.com";
const HOUR = 3_600_000;
if (!Number.isInteger(PAIRS) || PAIRS < 1 || PAIRS > DUPLICATES_PAGE_SIZE)
  throw new Error(
    `PAIRS must be a whole number from 1 to ${DUPLICATES_PAGE_SIZE}, got "${process.env.PAIRS}"`,
  );
if (!Number.isInteger(VISITS) || VISITS < 2 || VISITS - 1 > DAYS)
  throw new Error(
    `VISITS must be a whole number from 2 to DAYS + 1 (${DAYS + 1}), got "${process.env.VISITS}"`,
  );

const work = mkdtempSync(join(tmpdir(), "duplicates-cpu-"));
try {
  const sqlite = copyLocalD1(work);
  const worker = await buildWorker(work);
  const shim = d1Shim(sqlite);
  const env = { DB: shim.DB, AUTH_PEPPER: MEASURE_PEPPER };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  sqlite
    .prepare(
      "insert or ignore into users (email, role, active, created_at) values (?, 'admin', 1, 0)",
    )
    .run(ADMIN);
  sqlite
    .prepare(
      "insert or ignore into users (email, role, active, created_at) values (?, 'agent', 1, 0)",
    )
    .run(AGENT);
  const { cookie } = seedSession(sqlite, ADMIN, MEASURE_PEPPER);
  const headers = { Cookie: cookie };

  // PAIRS doors on a 5 km grid, a prospect and its renamed twin on each, so
  // the pairs found are these and only these. `updated_at` far ahead of any
  // seed row, so the page is filled with them whatever the database holds.
  const now = Date.now();
  const insertProspect = sqlite.prepare(
    `insert into prospects (id, name, type, lat, lng, source, dedupe_key, status, created_by, created_at, updated_at)
     values (?, ?, 'restaurant', ?, ?, 'csv', ?, 'new', 'measure@localhost', ?, ?)`,
  );
  const ids = [];
  for (let i = 0; i < PAIRS; i++) {
    const lat = 40 + (i % 10) * 0.05;
    const lng = 2 + Math.floor(i / 10) * 0.05;
    for (const [side, name] of [
      ["a", `Chez Mesure ${i}`],
      ["b", `Chez Mesure ${i} et Paul`],
    ]) {
      const id = crypto.randomUUID();
      insertProspect.run(id, name, lat, lng, `measure-dup:${i}:${side}`, now, now + 1_000_000_000);
      ids.push(id);
    }
  }

  // `VISITS` visits a prospect on VISITS - 1 Brussels days: the first two on one
  // day (a correction, so a door-day is sometimes more than one visit), each later
  // one a day on. Each prospect starts on another of DAYS days, so `Intl` has that
  // many days to find, as a real history would give it, at midday UTC (never near
  // a Brussels midnight).
  const insertVisit = sqlite.prepare(
    `insert into visits (id, prospect_id, agent_email, visited_at, client_visited_at, received_at,
       flyer_given, outcome, client_version)
     values (?, ?, ?, ?, ?, ?, 0, 'interested', 1)`,
  );
  const today = new Date(now);
  const noon = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12);
  const seedVisits = () => {
    for (const [i, id] of ids.entries()) {
      for (let v = 0; v < VISITS; v++) {
        const day = (i + Math.max(0, v - 1)) % DAYS;
        const visitedAt = noon - (DAYS + 1 - day) * 24 * HOUR + v * HOUR;
        insertVisit.run(`measure-dup-${id}-${v}`, id, AGENT, visitedAt, visitedAt, visitedAt);
      }
    }
  };
  const clearVisits = () => sqlite.exec("delete from visits where id like 'measure-dup-%'");

  const request = () => new Request("http://localhost/api/admin/prospects/duplicates", { headers });
  const once = () => {
    // Untimed, and only under `node --expose-gc`: earlier requests' young garbage
    // otherwise lands in a later request's timing, as measure-sync-cpu.mjs does.
    globalThis.gc?.({ type: "minor" });
    return timeRequest(worker, request(), env, shim);
  };

  /** The leg answered the full page with the counts the seed implies. */
  const check = async (counts) => {
    const response = await worker.fetch(request(), env, ctx);
    const body = await response.json();
    if (response.status !== 200 || body.pairs.length !== PAIRS)
      throw new Error(`expected ${PAIRS} pairs, got ${response.status} with ${body.pairs?.length}`);
    for (const p of body.pairs) {
      if (p.aVisits !== counts || p.bVisits !== counts)
        throw new Error(`expected ${counts} door-days a side, got ${p.aVisits} and ${p.bVisits}`);
    }
  };

  const legs = {
    without: { setup: clearVisits, doorDays: 0, workerMs: [], sqlMs: [], cold: null },
    with: { setup: seedVisits, doorDays: VISITS - 1, workerMs: [], sqlMs: [], cold: null },
  };

  for (let round = 0; round < ROUNDS; round++) {
    for (const [name, leg] of Object.entries(legs)) {
      clearVisits();
      leg.setup();
      // The process's first request ever is "without"'s of round 0: its cold start.
      if (round === 0 && name === "without") {
        const first = await once();
        leg.cold = first.total - first.sql;
      }
      await check(leg.doorDays);
      for (let i = 0; i < WARMUP; i++) await once();
      for (let i = 0; i < RUNS; i++) {
        const r = await once();
        leg.workerMs.push(r.total - r.sql);
        leg.sqlMs.push(r.sql);
      }
    }
  }

  const rows = [];
  let worst = 0;
  for (const [name, leg] of Object.entries(legs)) {
    leg.workerMs.sort((a, b) => a - b);
    leg.sqlMs.sort((a, b) => a - b);
    worst = Math.max(worst, leg.workerMs[leg.workerMs.length - 1]);
    rows.push({
      leg: name,
      requests: leg.workerMs.length,
      "worker median ms": at(leg.workerMs, 0.5).toFixed(2),
      "worker p95 ms": at(leg.workerMs, 0.95).toFixed(2),
      "worker max ms": leg.workerMs[leg.workerMs.length - 1].toFixed(2),
      "D1 median ms (not billed)": at(leg.sqlMs, 0.5).toFixed(2),
    });
  }
  console.table(rows);
  const median = (leg) => at(leg.workerMs, 0.5);
  console.log(
    `${PAIRS} pairs, ${VISITS} visits a prospect over ${VISITS - 1} of ${DAYS} days in the "with" leg, ${ROUNDS} alternating rounds.`,
  );
  console.log(
    `doorDayCounts' Worker CPU (median with minus median without): ${(median(legs.with) - median(legs.without)).toFixed(2)} ms.`,
  );
  console.log(
    `Cold first request (page of ${PAIRS} pairs, no visits): ${legs.without.cold.toFixed(2)} ms.`,
  );
  console.log(`GC=${typeof globalThis.gc === "function" ? "minor" : "off"}.`);
  console.log(`Worst request: ${worst.toFixed(2)} ms of Worker CPU, of the 10 ms budget.`);
  process.exitCode = worst < 10 ? 0 : 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
