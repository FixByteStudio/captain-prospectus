import type { Role } from "../shared/constants";

/**
 * Worker bindings.
 *
 * `wrangler types` infers the *literal* value of each var in wrangler.jsonc
 * (the placeholders there are empty strings), so the generated Env types them
 * as `""`. We widen them to `string` here, and add DEV_USER_EMAIL, which lives
 * in .dev.vars and so never appears in the generated file.
 */
export type Bindings = Omit<
  Env,
  "ACCESS_TEAM_DOMAIN" | "ACCESS_AUD" | "ADMIN_EMAILS" | "AGENT_EMAILS"
> & {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  /** Read by nothing since GH #303: the roster is the active `users` rows (ADR-0029). */
  AGENT_EMAILS?: string;
  /** Local development only; honoured only on localhost. See ADR-0006. */
  DEV_USER_EMAIL?: string;
  /**
   * Google Places API key — a **secret**, set with `wrangler secret put`, never
   * in wrangler.jsonc and never sent to the browser (ADR-0020).
   *
   * Optional on purpose: absent means the Google map provider is simply not
   * configured, the route answers 503, and the app works exactly as it did
   * before. A deployment with no billing account loses nothing.
   */
  GOOGLE_PLACES_KEY?: string;
  /**
   * Own login (ADR-0029), all set by the owner or CI and never in the repo.
   * AUTH_PEPPER and BREAK_GLASS are secrets; OWNER_EMAIL is a var kept out of
   * wrangler.jsonc. Optional so a Worker without them fails closed rather
   * than failing to type: no pepper → 500, no owner or break-glass → 401.
   */
  AUTH_PEPPER?: string;
  BREAK_GLASS?: string;
  OWNER_EMAIL?: string;
};

export type Identity = { email: string; role: Role };

export type AppEnv = {
  Bindings: Bindings;
  Variables: { identity: Identity };
};
