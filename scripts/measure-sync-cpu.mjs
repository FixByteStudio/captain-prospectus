/**
 * Measure `POST /api/agent/sync`'s Worker CPU per request, by batch size (GH #404).
 *
 * The same shim as measure-dashboard-cpu.mjs (worker-cpu-shim.mjs): the real
 * Worker in Node's V8, D1's own CPU taken out. Each request carries one visit to
 * each of SIZE distinct prospects assigned to the agent, so every visit derives
 * a status. The visits are bare: no notes, no answers, and no field prospects
 * ride along, so a real pass carrying those costs more than measured here. The
 * rows a request wrote are reset between requests, outside the timing, so every
 * request does the same work. Each size re-imports the module under a new query
 * string, which compiles it afresh: its first request stands in for a cold
 * isolate's, in a Node process that is otherwise warm. Sizes alternate over
 * ROUNDS, as in #102's before/after. Local hardware is not Cloudflare's: keep
 * headroom.
 *
 * Usage: pnpm db:migrate:local && (pnpm dev, then pnpm db:seed:local:full)
 *        node scripts/measure-sync-cpu.mjs
 * Env:   D1_SQLITE (the local D1 file; found under .wrangler/state),
 *        SIZES (1,25,50,100,200), ROUNDS (3), RUNS per size and round (50), WARMUP (20).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { at, buildWorker, copyLocalD1, d1Shim, timeRequest } from "./worker-cpu-shim.mjs";

const SIZES = (process.env.SIZES ?? "1,25,50,100,200").split(",").map(Number);
const ROUNDS = Number(process.env.ROUNDS ?? 3);
const RUNS = Number(process.env.RUNS ?? 50);
const WARMUP = Number(process.env.WARMUP ?? 20);
const AGENT = "agent@example.com";

const work = mkdtempSync(join(tmpdir(), "sync-cpu-"));
try {
  const sqlite = copyLocalD1(work);
  await buildWorker(work);
  const shim = d1Shim(sqlite);
  const env = {
    DB: shim.DB,
    DEV_USER_EMAIL: AGENT,
  };

  // Always SYNC_VISITS_PER_REQUEST (200) assigned prospects, whatever SIZES is:
  // the sync's pull lists them all, so a different count would change every
  // request's CPU and make runs with different SIZES incomparable.
  const SEEDED = 200;
  if (Math.max(...SIZES) > SEEDED)
    throw new Error(`SIZES above ${SEEDED} are refused by the server`);
  const ids = Array.from({ length: SEEDED }, () => crypto.randomUUID());
  const now = Date.now();
  const insert = sqlite.prepare(
    `insert into prospects (id, name, type, source, dedupe_key, status, assigned_to, created_by, created_at, updated_at)
     values (?, ?, 'restaurant', 'csv', ?, 'assigned', ?, 'seed@localhost', ?, ?)`,
  );
  for (const [i, id] of ids.entries()) {
    insert.run(id, `Mesure ${i}`, `measure:${id}`, AGENT, now, now);
  }
  const seeded = `(${ids.map((id) => `'${id}'`).join(",")})`;
  const reset = () =>
    sqlite.exec(
      `delete from visits where prospect_id in ${seeded};
       update prospects set status = 'assigned', last_visit_at = null, next_visit_at = null,
         status_set_at = null where id in ${seeded};`,
    );

  const request = (size) =>
    new Request("http://localhost/api/agent/sync", {
      method: "POST",
      // The Worker refuses a write without a same-origin Origin (src/worker/origin.ts).
      headers: { "Content-Type": "application/json", Origin: "http://localhost" },
      body: JSON.stringify({
        clientVersion: 1,
        prospects: [],
        visits: ids.slice(0, size).map((prospectId, i) => ({
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: Date.now() - i,
          flyerGiven: true,
          outcome: "interested",
          answers: {},
        })),
      }),
    });

  const once = async (worker, size) => {
    const r = await timeRequest(worker, request(size), env, shim);
    // A 200 alone could be the quarantine path (identity or assignment drifted),
    // which skips the inserts this is meant to time.
    const { n } = sqlite
      .prepare(`select count(*) as n from visits where prospect_id in ${seeded}`)
      .get();
    if (n !== size) throw new Error(`expected ${size} visits stored, found ${n}`);
    reset();
    return r.total - r.sql;
  };

  const cold = new Map(SIZES.map((s) => [s, []]));
  const warm = new Map(SIZES.map((s) => [s, []]));
  for (let round = 0; round < ROUNDS; round++) {
    for (const size of SIZES) {
      const url = pathToFileURL(join(work, "worker/worker.mjs"));
      url.search = `?size=${size}&round=${round}`;
      const worker = (await import(url.href)).default;
      cold.get(size).push(await once(worker, size));
      for (let i = 0; i < WARMUP; i++) await once(worker, size);
      for (let i = 0; i < RUNS; i++) warm.get(size).push(await once(worker, size));
    }
  }

  const rows = SIZES.map((size) => {
    const w = warm.get(size).sort((a, b) => a - b);
    const c = cold.get(size).sort((a, b) => a - b);
    return {
      "visits per request": size,
      "warm median ms": at(w, 0.5).toFixed(2),
      "warm p95 ms": at(w, 0.95).toFixed(2),
      "warm max ms": w[w.length - 1].toFixed(2),
      "cold ms (each round)": c.map((x) => x.toFixed(1)).join(" / "),
    };
  });
  console.table(rows);
} finally {
  rmSync(work, { recursive: true, force: true });
}
