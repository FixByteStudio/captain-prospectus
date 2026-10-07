/**
 * CAP-7: guessing codes or passphrases is throttled per IP, in a D1 table
 * rather than the rate-limiting binding (_bmad-output/specs/spec-own-login).
 *
 * Windows are fixed, not sliding: one row per IP per window, and "until the
 * window ends" is a single Retry-After. Each login reserves its failure in one
 * conditional upsert before the credential is looked at, so a burst of
 * parallel guesses cannot all read a low count: at most LOGIN_MAX_FAILURES
 * get through per window, however many arrive at once.
 *
 * Nothing here logs. The IP is personal data and is stored only as its HMAC.
 */
import { createMiddleware } from "hono/factory";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { loginAttempts } from "./db/schema";
import { hmacHex } from "./session";
import type { AppEnv } from "./types";

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Every request without the header shares one bucket rather than going unthrottled. */
const UNKNOWN_IP = "unknown";

/**
 * The bucket an address counts in. One host usually holds a whole IPv6 /64,
 * so an IPv6 address counts by its first four groups, or it could rotate
 * through addresses and never be throttled. IPv4 counts per address.
 */
export function throttleKey(ip: string | undefined): string {
  if (!ip) return UNKNOWN_IP;
  if (!ip.includes(":")) return ip;
  // An IPv4-mapped address (::ffff:192.0.2.1) is that IPv4 address.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped?.[1]) return mapped[1];
  const [head = "", tail] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

/**
 * Runs before validation and before the credential, so a locked IP is refused
 * whatever it sends. Every 400 or 401 the login answers keeps its reserved
 * failure; any other answer, a success included, hands it back, so a success
 * neither counts nor resets the count. Without AUTH_PEPPER no IP can be
 * hashed, and the route's own 500 answers instead.
 */
export const loginThrottle = createMiddleware<AppEnv>(async (c, next) => {
  const pepper = c.env.AUTH_PEPPER;
  if (!pepper) return next();

  const now = Date.now();
  const windowStart = now - (now % LOGIN_WINDOW_MS);
  const ipHash = await hmacHex(pepper, throttleKey(c.req.header("CF-Connecting-IP")));
  const db = getDb(c.env.DB);
  const thisRow = and(eq(loginAttempts.ipHash, ipHash), eq(loginAttempts.windowStart, windowStart));

  // The upsert this table is allowed (docs/data-model.md). A locked row is
  // left untouched and returns nothing, so hammering a locked IP costs reads,
  // not D1 writes.
  const reserved = await db
    .insert(loginAttempts)
    .values({ ipHash, windowStart, failures: 1 })
    .onConflictDoUpdate({
      target: [loginAttempts.ipHash, loginAttempts.windowStart],
      set: { failures: sql`${loginAttempts.failures} + 1` },
      setWhere: lt(loginAttempts.failures, LOGIN_MAX_FAILURES),
    })
    .returning({ failures: loginAttempts.failures });
  if (reserved.length === 0) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + LOGIN_WINDOW_MS - now) / 1000));
    c.header("Retry-After", String(retryAfter));
    return c.json(
      { error: "too_many_attempts", message: "Too many failed sign-ins. Try again later." },
      429,
    );
  }

  // A thrown HTTPException has already been through onError here, so c.res
  // carries its status.
  await next();
  if (c.res.status === 400 || c.res.status === 401) return;

  try {
    await db
      .update(loginAttempts)
      .set({ failures: sql`${loginAttempts.failures} - 1` })
      .where(thisRow);
  } catch {
    // The answer is already decided; losing the refund only counts one
    // attempt too many, while throwing would turn a signed-in 200 into a 500.
  }
});
