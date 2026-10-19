/**
 * Measure `POST /api/agent/sync`'s Worker CPU per request, by batch size (GH #404).
 *
 * The same shim as measure-dashboard-cpu.mjs (worker-cpu-shim.mjs): the real
 * Worker in Node's V8, D1's own CPU taken out. It authenticates the way
 * production does (GH #415): a seeded `sessions` row, its `__Host-cp_session`
 * cookie and `AUTH_PEPPER`, with `DEV_USER_EMAIL` unset, so a request that was
 * not session-authenticated answers 401 and fails the run. Each request carries
 * one visit to each of SIZE distinct prospects assigned to the agent, so every
 * visit derives a status. By default the visits are bare (no notes, no answers)
 * and no field prospects ride along; PAYLOAD and PROSPECTS add what a real pass
 * carries (GH #449, #450). Every timed request must answer 200 *and* have
 * stored what it sent, so a quarantine or a 401 path is never timed by mistake.
 * The rows a request wrote are reset between requests, outside the timing, so
 * every request does the same work. Each size re-imports the module under a new
 * query string, which compiles it afresh: its first request stands in for a cold
 * isolate's, in a Node process that is otherwise warm. Sizes alternate over
 * ROUNDS, as in #102's before/after. Local hardware is not Cloudflare's: keep
 * headroom.
 *
 * Usage: pnpm db:migrate:local && (pnpm dev, then pnpm db:seed:local:full)
 *        node scripts/measure-sync-cpu.mjs
 * Env:   D1_SQLITE (the local D1 file; found under .wrangler/state),
 *        SIZES (1,25,50,100,200; with PAYLOAD=max, the one count that fits),
 *        ROUNDS (3), RUNS per size and round (50), WARMUP (20),
 *        TOURNEE (unset; "pull" seeds today's 200-stop tournée, "swipe" sends one with 200 stops),
 *        SLIDE (unset; "1" sets the session's last_seen_at back past SESSION_SLIDE_MS before each
 *          request, so each one runs the sliding UPDATE),
 *        PAYLOAD ("bare"; "full" gives each visit 2,000 accented characters of notes, the active
 *          script's id and 50 mixed answers; "max" gives it the heaviest the server accepts, and
 *          the count is the most that fits MAX_REQUEST_BYTES),
 *        PROSPECTS (0; 1 to 100 field prospects ride along with each request's visits).
 *        SETTLE (unset; "1" runs a full collection and one untimed request of the same size
 *          before each warm timed request, so the warm max is the request's own cost, not an
 *          earlier request's old-space garbage; needs --expose-gc; the cold request is not settled).
 * Run with `node --expose-gc` to run a minor collection before each request, outside the timing.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  MEASURE_PEPPER,
  at,
  buildWorker,
  copyLocalD1,
  d1Shim,
  seedSession,
  timeRequest,
} from "./worker-cpu-shim.mjs";

// Copies of src/shared/constants.ts, as 200 below is: this script must not import src/.
const MAX_REQUEST_BYTES = 2_097_152; // MAX_REQUEST_BYTES
const SYNC_VISITS_PER_REQUEST = 200; // SYNC_VISITS_PER_REQUEST
const SYNC_PROSPECTS_PER_REQUEST = 100; // SYNC_PROSPECTS_PER_REQUEST
const SCRIPT_QUESTIONS_MAX = 50; // SCRIPT_QUESTIONS_MAX: answers per visit
const QUESTION_KEY_MAX = 60; // QUESTION_KEY_MAX
const QUESTION_OPTIONS_MAX = 30; // QUESTION_OPTIONS_MAX: choices in one multi answer
const SHORT_TEXT_MAX = 200; // SHORT_TEXT_MAX
const LONG_TEXT_MAX = 2000; // LONG_TEXT_MAX: notes and a text answer
const SESSION_SLIDE_MS = 3_600_000; // SESSION_SLIDE_MS (src/worker/session.ts)

const sizesAsked = process.env.SIZES;
const ROUNDS = Number(process.env.ROUNDS ?? 3);
const RUNS = Number(process.env.RUNS ?? 50);
const WARMUP = Number(process.env.WARMUP ?? 20);
const AGENT = "agent@example.com";
const TOURNEE = process.env.TOURNEE;
if (TOURNEE !== undefined && TOURNEE !== "pull" && TOURNEE !== "swipe")
  throw new Error(`TOURNEE must be "pull" or "swipe", got "${TOURNEE}"`);
const PAYLOAD = process.env.PAYLOAD ?? "bare";
if (!["bare", "full", "max"].includes(PAYLOAD))
  throw new Error(`PAYLOAD must be "bare", "full" or "max", got "${PAYLOAD}"`);
const SLIDE = process.env.SLIDE;
if (SLIDE !== undefined && SLIDE !== "1")
  throw new Error(`SLIDE must be unset or "1", got "${SLIDE}"`);
const SETTLE = process.env.SETTLE;
if (SETTLE !== undefined && SETTLE !== "1")
  throw new Error(`SETTLE must be unset or "1", got "${SETTLE}"`);
if (SETTLE && typeof globalThis.gc !== "function")
  throw new Error("SETTLE=1 needs `node --expose-gc`");
const PROSPECTS = Number(process.env.PROSPECTS ?? 0);
if (!Number.isInteger(PROSPECTS) || PROSPECTS < 0 || PROSPECTS > SYNC_PROSPECTS_PER_REQUEST)
  throw new Error(
    `PROSPECTS must be a whole number from 0 to ${SYNC_PROSPECTS_PER_REQUEST}, got "${process.env.PROSPECTS}"`,
  );

const work = mkdtempSync(join(tmpdir(), "sync-cpu-"));
try {
  const sqlite = copyLocalD1(work);
  const shim = d1Shim(sqlite);
  // No DEV_USER_EMAIL: the cookie is the only way in (GH #415).
  const env = { DB: shim.DB, AUTH_PEPPER: MEASURE_PEPPER };
  const { cookie, tokenHash } = seedSession(sqlite, AGENT, MEASURE_PEPPER);

  // Always SYNC_VISITS_PER_REQUEST (200) assigned prospects, whatever SIZES is:
  // the sync's pull lists them all, so a different count would change every
  // request's CPU and make runs with different SIZES incomparable.
  const SEEDED = SYNC_VISITS_PER_REQUEST;
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

  // Only "full" and "max" name a script; an unknown id is nulled by the server
  // (agent.ts), which the stored-script assertion below would catch.
  const scriptId =
    PAYLOAD === "bare"
      ? null
      : sqlite.prepare("select id from scripts where is_active = 1").get()?.id;
  if (PAYLOAD !== "bare" && typeof scriptId !== "number")
    throw new Error(`PAYLOAD=${PAYLOAD} needs an active script: run the full seed`);

  // Accented, as the field is: "é" is 2 bytes in UTF-8, so a note costs twice its characters.
  const notes = "é".repeat(LONG_TEXT_MAX);
  const answers = () => {
    const out = {};
    for (let i = 0; i < SCRIPT_QUESTIONS_MAX; i++) {
      if (PAYLOAD === "max") {
        // Keys at their cap, every value at LONG_TEXT_MAX.
        out[`question_${i}`.padEnd(QUESTION_KEY_MAX, "_")] = "a".repeat(LONG_TEXT_MAX);
        continue;
      }
      const key = `question_${String(i).padStart(2, "0")}`;
      // Ten of each kind of answer a script's questions can take.
      out[key] = [
        i % 2 === 0, // yes_no
        (i % 5) + 1, // rating, number
        `Réponse courte ${i}`.padEnd(SHORT_TEXT_MAX, "."), // short text
        "a".repeat(LONG_TEXT_MAX), // long text
        Array.from({ length: QUESTION_OPTIONS_MAX }, (_, o) =>
          `Option numéro ${o}`.padEnd(20, " "),
        ), // multi, at its cap
      ][i % 5];
    }
    return out;
  };

  // Unique by name: two field prospects with one dedupe key would merge into one.
  const fieldProspects = () =>
    Array.from({ length: PROSPECTS }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `Terrain ${i} ${crypto.randomUUID()}`,
      type: "restaurant",
      lat: 50.84 + i / 10_000,
      lng: 4.35 + i / 10_000,
      address: `Rue de la Mesure ${i}, 1000 Bruxelles`,
      phone: "+3225550000",
      createdAt: Date.now() - i,
    }));

  // Run on the temporary copy only: a tournée the agent already has would win the
  // unique (agent, day) over the one a swipe sends.
  const clearTournees = `delete from tournee_stops where tournee_id in
    (select id from tournees where agent_email = '${AGENT}');
    delete from tournees where agent_email = '${AGENT}';`;
  sqlite.exec(clearTournees);
  const reset = (sentProspects) =>
    sqlite.exec(
      `delete from visits where prospect_id in ${seeded};
       update prospects set status = 'assigned', last_visit_at = null, next_visit_at = null,
         status_set_at = null where id in ${seeded};
       ${sentProspects.length > 0 ? `delete from prospects where id in (${sentProspects.map((p) => `'${p.id}'`).join(",")});` : ""}
       ${TOURNEE === "swipe" ? clearTournees : ""}`,
    );

  // The body of one request; the morning pass adds a new tournée and a stop per
  // seeded prospect beside the visits.
  const payload = (size, { swipe, prospects }) => {
    const tourneeId = crypto.randomUUID();
    const morning = swipe
      ? {
          tournees: [{ id: tourneeId, startedAt: Date.now() }],
          stops: ids.map((prospectId, i) => ({
            id: crypto.randomUUID(),
            tourneeId,
            prospectId,
            number: i + 1,
            addedAt: Date.now(),
          })),
        }
      : {};
    const sent = prospects ? fieldProspects() : [];
    const body = JSON.stringify({
      clientVersion: 2,
      prospects: sent,
      ...morning,
      visits: ids.slice(0, size).map((prospectId, i) => ({
        id: crypto.randomUUID(),
        prospectId,
        visitedAt: Date.now() - i,
        flyerGiven: true,
        outcome: "interested",
        ...(PAYLOAD === "bare" ? {} : { notes, scriptId }),
        answers: PAYLOAD === "bare" ? {} : answers(),
      })),
    });
    return { body, sent };
  };
  const bytesOf = (size) =>
    Buffer.byteLength(payload(size, { swipe: TOURNEE === "swipe", prospects: true }).body);

  // The most visits one request can carry under MAX_REQUEST_BYTES (UTF-8 bytes, as the
  // Worker counts): a real phone sends any count that fits (serializeWithinCap).
  let fits = 1;
  for (let lo = 1, hi = SEEDED; lo <= hi;) {
    const mid = (lo + hi) >> 1;
    if (bytesOf(mid) > MAX_REQUEST_BYTES) {
      hi = mid - 1;
    } else {
      fits = mid;
      lo = mid + 1;
    }
  }
  const SIZES =
    sizesAsked === undefined && PAYLOAD === "max"
      ? [fits]
      : (sizesAsked ?? "1,25,50,100,200").split(",").map(Number);
  for (const size of SIZES) {
    if (!Number.isInteger(size) || size < 1 || size > SEEDED)
      throw new Error(`SIZES holds whole numbers from 1 to ${SEEDED}, got "${size}"`);
    if (size > fits)
      throw new Error(
        `${size} visits of PAYLOAD=${PAYLOAD} exceed MAX_REQUEST_BYTES (${MAX_REQUEST_BYTES}): ${fits} fit`,
      );
  }

  await buildWorker(work);

  const request = (size, flags) => {
    const { body, sent } = payload(size, flags);
    return {
      sent,
      request: new Request("http://localhost/api/agent/sync", {
        method: "POST",
        // The Worker refuses a write without a same-origin Origin (src/worker/origin.ts).
        headers: { "Content-Type": "application/json", Origin: "http://localhost", Cookie: cookie },
        body,
      }),
    };
  };

  const lastSeenAt = () =>
    sqlite.prepare("select last_seen_at as t from sessions where token_hash = ?").get(tokenHash).t;

  const once = async (worker, size, { settle = false } = {}) => {
    // Untimed: SETTLE=1 collects everything, old space included, then re-warms the code a full
    // collection leaves cold with one request of the same size (GH #450).
    if (settle) {
      globalThis.gc();
      await once(worker, size);
    }
    // Untimed: a session idle past SESSION_SLIDE_MS is slid by this request's UPDATE.
    const stale = Date.now() - 2 * SESSION_SLIDE_MS;
    if (SLIDE) {
      sqlite
        .prepare("update sessions set last_seen_at = ? where token_hash = ?")
        .run(stale, tokenHash);
    }
    const { request: req, sent } = request(size, {
      swipe: TOURNEE === "swipe",
      prospects: true,
    });
    // Untimed, and only under `node --expose-gc`: earlier requests' young garbage otherwise
    // lands in this request's window. Minor only: a full collection here added ~3.5 ms to every
    // request, even a one-visit one, by leaving the next request cold (GH #450).
    globalThis.gc?.({ type: "minor" });
    const r = await timeRequest(worker, req, env, shim);
    // A 200 alone could be the quarantine path (identity or assignment drifted),
    // which skips the inserts this is meant to time.
    const { n } = sqlite
      .prepare(`select count(*) as n from visits where prospect_id in ${seeded}`)
      .get();
    if (n !== size) throw new Error(`expected ${size} visits stored, found ${n}`);
    if (PAYLOAD !== "bare") assertContent(size);
    if (sent.length > 0) assertProspects(sent);
    if (SLIDE && lastSeenAt() <= stale) throw new Error("SLIDE=1: the session did not slide");
    if (TOURNEE === "swipe") assertTournee();
    reset(sent);
    return r.total - r.sql;
  };

  // The notes and the script survived: an unknown script id is nulled, not refused.
  const assertContent = (size) => {
    const { n } = sqlite
      .prepare(
        `select count(*) as n from visits
         where prospect_id in ${seeded} and script_id = ? and length(notes) = ? and (select count(*) from json_each(answers)) = ${SCRIPT_QUESTIONS_MAX}`,
      )
      .get(scriptId, LONG_TEXT_MAX);
    if (n !== size)
      throw new Error(`expected ${size} visits with notes and answers stored, found ${n}`);
  };

  const assertProspects = (sent) => {
    const { n } = sqlite
      .prepare(
        `select count(*) as n from prospects
         where source = 'field' and created_by = ? and id in (${sent.map((p) => `'${p.id}'`).join(",")})`,
      )
      .get(AGENT);
    if (n !== sent.length)
      throw new Error(`expected ${sent.length} field prospects stored, found ${n}`);
  };

  const assertTournee = () => {
    const t = sqlite
      .prepare(`select count(*) as n from tournees where agent_email = ?`)
      .get(AGENT).n;
    const stops = sqlite
      .prepare(`select count(*) as n from tournee_stops where prospect_id in ${seeded}`)
      .get().n;
    if (t !== 1 || stops !== SEEDED)
      throw new Error(`expected 1 tournée and ${SEEDED} stops stored, found ${t} and ${stops}`);
  };

  // "pull": one untimed swipe stores today's tournée, which every timed pull then reads.
  // The Worker computes its Brussels day, so the script needs no copy of period.ts.
  if (TOURNEE === "pull") {
    const url = pathToFileURL(join(work, "worker/worker.mjs"));
    url.search = "?seed";
    const seed = request(0, { swipe: true, prospects: false });
    await timeRequest((await import(url.href)).default, seed.request, env, shim);
    assertTournee();
  }

  console.log(
    `PAYLOAD=${PAYLOAD} PROSPECTS=${PROSPECTS} SLIDE=${SLIDE ?? "unset"} TOURNEE=${TOURNEE ?? "unset"} ` +
      `SETTLE=${SETTLE ?? "unset"} GC=${typeof globalThis.gc === "function" ? "minor" : "off"}; ` +
      `authenticated by session cookie (AUTH_PEPPER), no DEV_USER_EMAIL; ` +
      `${MAX_REQUEST_BYTES} bytes is the cap, ${fits} visits of this payload fit`,
  );
  const cold = new Map(SIZES.map((s) => [s, []]));
  const warm = new Map(SIZES.map((s) => [s, []]));
  for (let round = 0; round < ROUNDS; round++) {
    for (const size of SIZES) {
      const url = pathToFileURL(join(work, "worker/worker.mjs"));
      url.search = `?size=${size}&round=${round}`;
      const worker = (await import(url.href)).default;
      cold.get(size).push(await once(worker, size));
      for (let i = 0; i < WARMUP; i++) await once(worker, size);
      for (let i = 0; i < RUNS; i++)
        warm.get(size).push(await once(worker, size, { settle: SETTLE === "1" }));
    }
  }

  const rows = SIZES.map((size) => {
    const w = warm.get(size).sort((a, b) => a - b);
    const c = cold.get(size).sort((a, b) => a - b);
    return {
      "visits sent": size,
      "KiB per request": (bytesOf(size) / 1024).toFixed(1),
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
