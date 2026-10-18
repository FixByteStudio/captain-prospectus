/**
 * What the CPU measurements share (GH #113, #404): the real Worker, bundled by
 * Vite into one minified ESM file, run in Node's V8 against a copy of the local
 * D1, with SQLite's own CPU measured and taken out. Why it is done this way is
 * in measure-dashboard-cpu.mjs.
 */
import { createHmac, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { build } from "vite";

export const ROOT = resolve(import.meta.dirname, "..");

/** The local D1 file: D1_SQLITE, or the one under .wrangler/state. */
export function localD1() {
  if (process.env.D1_SQLITE) return process.env.D1_SQLITE;
  const dir = join(ROOT, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  const file = readdirSync(dir).find((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (!file) throw new Error(`no local D1 in ${dir}: run pnpm db:migrate:local and the seed`);
  return join(dir, file);
}

/**
 * A copy of the local D1 in `work`, so the live dev database is only ever
 * read. Migrations the dev database has not had yet are applied to the copy.
 */
export function copyLocalD1(work) {
  const copy = join(work, "d1.sqlite");
  new DatabaseSync(localD1(), { readOnly: true }).exec(`vacuum into '${copy}'`);
  const sqlite = new DatabaseSync(copy);
  const applied = new Set(
    sqlite
      .prepare("select name from d1_migrations")
      .all()
      .map((r) => r.name),
  );
  const dir = join(ROOT, "drizzle");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (applied.has(file)) continue;
    for (const sql of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      sqlite.exec(sql);
    }
  }
  return sqlite;
}

/** The pepper every measurement signs its session under (`AUTH_PEPPER` in the Worker's env). */
export const MEASURE_PEPPER = "measure-pepper";

/**
 * A signed-in session for `email` in the temporary copy, the way production
 * authenticates (GH #415): the `sessions` row holds the HMAC of a random token
 * under `pepper`, and the request carries the token in the `__Host-cp_session`
 * cookie. The cookie name is `SESSION_COOKIE` in src/worker/session.ts, and the
 * hash is `hmacHex` (the same lowercase-hex HMAC-SHA-256). With `DEV_USER_EMAIL`
 * unset in the env, a request that is not session-authenticated answers 401.
 */
export function seedSession(sqlite, email, pepper) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHmac("sha256", pepper).update(token).digest("hex");
  const now = Date.now();
  sqlite
    .prepare(
      `insert into sessions (token_hash, user_email, created_at, last_seen_at, expires_at, id)
       values (?, ?, ?, ?, ?, ?)`,
    )
    // 90 days is an agent's TTL (SESSION_TTL_MS). An admin's is 30, but the dashboard run never slides, so its expiry does not matter there.
    .run(tokenHash, email, now, now, now + 90 * 24 * 3_600_000, randomBytes(16).toString("hex"));
  return { cookie: `__Host-cp_session=${token}`, token, tokenHash };
}

/** The Worker's default export, built into `work/worker`. */
export async function buildWorker(work) {
  await build({
    root: ROOT,
    configFile: false,
    logLevel: "warn",
    build: {
      ssr: join(ROOT, "src/worker/index.ts"),
      outDir: join(work, "worker"),
      emptyOutDir: true,
      minify: true,
      rollupOptions: { output: { format: "es", entryFileNames: "worker.mjs" } },
    },
    ssr: { noExternal: true, target: "webworker" },
  });
  return (await import(pathToFileURL(join(work, "worker/worker.mjs")).href)).default;
}

/**
 * A D1Database over `sqlite` with what drizzle-orm/d1 calls on it, and nothing
 * else. `sqlUs()` is the CPU µs spent inside SQLite since the last `resetSql()`.
 */
export function d1Shim(sqlite) {
  let sqlUs = 0;
  const timed = (run) => {
    const start = process.cpuUsage();
    try {
      return run();
    } finally {
      const used = process.cpuUsage(start);
      sqlUs += used.user + used.system;
    }
  };
  const statement = (query, params = []) => ({
    bind: (...next) => statement(query, next),
    all: async () => ({
      results: timed(() => sqlite.prepare(query).all(...params)),
      success: true,
      meta: {},
    }),
    raw: async () =>
      timed(() => {
        const stmt = sqlite.prepare(query);
        stmt.setReturnArrays(true);
        return stmt.all(...params);
      }),
    first: async () => timed(() => sqlite.prepare(query).get(...params) ?? null),
    run: async () => ({ ...timed(() => sqlite.prepare(query).run(...params)), success: true }),
  });
  return {
    DB: {
      prepare: (query) => statement(query),
      batch: async (s) => Promise.all(s.map((x) => x.all())),
    },
    sqlUs: () => sqlUs,
    resetSql: () => {
      sqlUs = 0;
    },
  };
}

/** One request's Worker CPU in ms, SQLite's taken out. */
export async function timeRequest(worker, request, env, shim) {
  shim.resetSql();
  const start = process.cpuUsage();
  const response = await worker.fetch(request, env, {
    waitUntil() {},
    passThroughOnException() {},
  });
  const body = await response.text();
  const used = process.cpuUsage(start);
  if (response.status !== 200) throw new Error(`${request.url}: ${response.status} ${body}`);
  return { total: (used.user + used.system) / 1000, sql: shim.sqlUs() / 1000 };
}

/** The q-quantile of an ascending array. */
export const at = (xs, q) => xs[Math.min(xs.length - 1, Math.floor(q * xs.length))];
