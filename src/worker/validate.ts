/**
 * INVARIANT 6: every request body is validated with a schema from
 * src/shared/schemas.ts. This is the only place a zod error becomes a response,
 * so the shape of a 400 is identical everywhere (docs/api.md).
 */
import { zValidator } from "@hono/zod-validator";
import type { $ZodIssue, $ZodType } from "zod/v4/core";
import type { Context, ValidationTargets } from "hono";

/**
 * Raw zod issues grow with the body (a union nests one error list per member),
 * and no client reads them, so a 400 carries a bounded summary (#36).
 */
export const MAX_VALIDATION_ISSUES = 20;

/** The one 400 body a failed schema produces, whichever path validated it. */
export function validationFailed(c: Context, issues: readonly $ZodIssue[]) {
  const summary = issues.slice(0, MAX_VALIDATION_ISSUES).map((issue) => ({
    path: issue.path.map((key) => (typeof key === "symbol" ? String(key) : key)),
    code: issue.code,
  }));
  return c.json({ error: "validation" as const, issues: summary }, 400);
}

export function validate<T extends $ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) return validationFailed(c, result.error.issues);
    return undefined;
  });
}
