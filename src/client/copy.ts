/**
 * Every French string in the app (ADR-0013, INVARIANT 15), split by audience
 * under `copy/` (GH #20): `shared.ts`, `field.ts` and `admin.ts`.
 *
 * Admin screens import this full aggregator; every other module imports
 * `./copy/field`, so admin strings stay out of the field route's precache.
 * Components never inline a French literal, so a second language would mean
 * replacing these modules, not touching components.
 */
import { copy as fieldRouteCopy } from "./copy/field";
import { adminCopy } from "./copy/admin";

export * from "./copy/shared";

export const copy = { ...fieldRouteCopy, ...adminCopy } as const;
