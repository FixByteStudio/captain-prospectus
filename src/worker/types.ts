import type { Role } from "../shared/constants";

/**
 * Worker bindings.
 *
 * `wrangler types` generates the bindings declared in wrangler.jsonc. The
 * secrets and local-only values below live in .dev.vars or the dashboard, so
 * they never appear in the generated file and are added here.
 */
export type Bindings = Env & {
  /** Local development only; honoured only on localhost. See ADR-0029. */
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
    /** The caller's session's public id; unset for DEV_USER_EMAIL callers. */
    sessionId?: string;
  };
};
