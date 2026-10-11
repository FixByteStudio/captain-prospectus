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
  /** A secret (ADR-0020 §7); absent means the Google provider answers 503. */
  GOOGLE_PLACES_KEY?: string;
  /**
   * Own login (ADR-0029); how they are set is in docs/deployment.md. Optional so
   * a Worker without them fails closed rather than failing to type.
   */
  AUTH_PEPPER?: string;
  BREAK_GLASS?: string;
  OWNER_EMAIL?: string;
};

export type Identity = { email: string; role: Role };

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    identity: Identity;
    /** The caller's session's public id; unset for DEV_USER_EMAIL and Access callers. */
    sessionId?: string;
  };
};
