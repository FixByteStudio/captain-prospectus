/**
 * CAP-8: no other site can make a state-changing request with the user's
 * session. Browsers send Origin on every non-GET request, so the app and the
 * field sync pass untouched; a missing one is refused too, since only a
 * non-browser caller omits it and the seed scripts and tests send their own.
 *
 * No route is exempt, /api/auth and /api/dev included.
 */
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./types";

const SAFE_METHODS = new Set(["GET", "HEAD"]);

export const requireSameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();
  // `Origin: null` (sandboxed frames, some redirects) never equals a URL's origin.
  if (c.req.header("Origin") !== new URL(c.req.url).origin) {
    return c.json({ error: "forbidden_origin", message: "Cross-site request refused." }, 403);
  }
  return next();
});
