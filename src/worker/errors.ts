/**
 * D1 has no error code for its free-tier daily limit — Cloudflare documents it
 * only by message: https://developers.cloudflare.com/d1/observability/debug-d1/#error-list.
 * Every query in this Worker goes through Drizzle 0.45, which wraps a failing
 * query as a `DrizzleQueryError` and puts D1's own error on `.cause`
 * (`drizzle-orm/sqlite-core/session.js`, `queryWithCache`), so the message can
 * be on the error itself or anywhere up its `cause` chain.
 */
// Anchored: D1's own message starts with this text. Without the anchor, a
// `DrizzleQueryError`'s own message — `Failed query: <sql>\nparams: <values>`
// — could match on a bound value that happens to contain the phrase (e.g. a
// visit note), turning an unrelated failure into a false 503.
const DAILY_LIMIT_PATTERN =
  /^Your account has exceeded D1's free tier daily row (read|write) limit/;

/** Bounds the walk so a cyclic `cause` (however unlikely) cannot loop forever. */
const MAX_CAUSE_DEPTH = 5;

export function isD1DailyLimitError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (!(current instanceof Error)) return false;
    if (DAILY_LIMIT_PATTERN.test(current.message)) return true;
    current = current.cause;
  }
  return false;
}
