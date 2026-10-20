/**
 * Measure `GET /api/admin/dashboard`'s Worker CPU per request (GH #113).
 *
 * Workers Free meters 10 ms of CPU per request (INVARIANT 13) and does not
 * count the time spent waiting on D1. Nothing local enforces or reports that
 * figure: a Worker cannot time itself (`Date.now()` only moves across I/O),
 * workerd's inspector samples a request only a few times and books each wait
 * on D1 to whatever frame runs next, and the workerd process's CPU also holds
 * the local D1's SQLite and the dev proxy.
 *
 * So this runs the real Worker, bundled by Vite into one minified ESM file
 * (close to, not byte for byte, the Cloudflare plugin's build), in Node's V8
 * — the engine workerd embeds — against a copy of the local seeded D1, with
 * any drizzle/ migration the dev database lacks applied to the copy. D1 is
 * a synchronous `node:sqlite` shim whose own CPU is measured and taken out,
 * which leaves what production bills: routing, auth, zod, `Intl`, row mapping
 * and JSON. It first times a cold request, the fresh module's first, then
 * warm ones. It authenticates the way production does (GH #415): a seeded
 * `sessions` row, its `__Host-cp_session` cookie and `AUTH_PEPPER`, with
 * `DEV_USER_EMAIL` unset, so the HMAC and the session lookup are in the figure.
 * Local hardware is not Cloudflare's: keep headroom. Written against Node 24
 * (`node:sqlite`'s `setReturnArrays`).
 *
 * Usage: pnpm db:migrate:local && (pnpm dev, then pnpm db:seed:local:full)
 *        node scripts/measure-dashboard-cpu.mjs
 * Env:   D1_SQLITE (the local D1 file; found under .wrangler/state),
 *        RUNS per period (200), WARMUP (50),
 *        EXPLAIN=1 to print each statement's query plan instead, with its
 *        bound-parameter count (INVARIANT 7).
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

const RUNS = Number(process.env.RUNS ?? 200);
const WARMUP = Number(process.env.WARMUP ?? 50);
const PERIODS = [7, 30, 90];
const ADMIN = "admin@example.com";

const work = mkdtempSync(join(tmpdir(), "dashboard-cpu-"));
try {
  // A copy, so the live dev database is only ever read.
  const sqlite = copyLocalD1(work);
  const worker = await buildWorker(work);
  const shim = d1Shim(sqlite);
  const { cookie } = seedSession(sqlite, ADMIN, MEASURE_PEPPER);
  const env = { DB: shim.DB, AUTH_PEPPER: MEASURE_PEPPER };
  const headers = { Cookie: cookie };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const once = (period) =>
    timeRequest(
      worker,
      new Request(`http://localhost/api/admin/dashboard?period=${period}`, { headers }),
      env,
      shim,
    );

  const explainOnly = Boolean(process.env.EXPLAIN);
  if (explainOnly) {
    const seen = [];
    const explain = {
      ...env,
      DB: { prepare: (query) => (seen.push(query), env.DB.prepare(query)) },
    };
    const response = await worker.fetch(
      new Request("http://localhost/api/admin/dashboard?period=90", { headers }),
      explain,
      ctx,
    );
    await response.text();
    for (const [i, query] of seen.entries()) {
      const params = (query.match(/\?/g) ?? []).length;
      console.log(`\n#${i + 1} (${params} bound parameters)\n${query}`);
      // Placeholders bound to null: the plan depends on the shape, not the values.
      const plan = sqlite.prepare(`explain query plan ${query}`).all(...Array(params).fill(null));
      for (const row of plan) console.log(`  ${row.detail}`);
    }
  } else {
    // A cold isolate's first request pays for compiling what it runs: the
    // thin case, so it is measured and gated too.
    const first = await once(PERIODS[0]);
    const cold = first.total - first.sql;
    const rows = [
      { period: `${PERIODS[0]} (cold, first request)`, runs: 1, "worker max ms": cold.toFixed(2) },
    ];
    let worst = cold;
    for (const period of PERIODS) {
      for (let i = 0; i < WARMUP; i++) await once(period);
      const workerMs = [];
      const sqlMs = [];
      for (let i = 0; i < RUNS; i++) {
        const r = await once(period);
        workerMs.push(r.total - r.sql);
        sqlMs.push(r.sql);
      }
      workerMs.sort((a, b) => a - b);
      sqlMs.sort((a, b) => a - b);
      worst = Math.max(worst, workerMs[workerMs.length - 1]);
      rows.push({
        period,
        runs: RUNS,
        "worker median ms": at(workerMs, 0.5).toFixed(2),
        "worker p95 ms": at(workerMs, 0.95).toFixed(2),
        "worker max ms": workerMs[workerMs.length - 1].toFixed(2),
        "D1 median ms (not billed)": at(sqlMs, 0.5).toFixed(2),
      });
    }
    console.table(rows);
    console.log(`Worst request: ${worst.toFixed(2)} ms of Worker CPU, of the 10 ms budget.`);
    process.exitCode = worst < 10 ? 0 : 1;
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
