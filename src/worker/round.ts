import { and, eq, inArray, isNull } from "drizzle-orm";
import { OPEN_STATUSES } from "../shared/constants";
import { prospects } from "./db/schema";
import type { Db } from "./db/client";

/**
 * An agent's open, live prospects: what sync pulls and what the admin's round
 * view lists. A merged prospect is gone as far as the round is concerned, so the
 * agent stops walking to the same door twice.
 */
export function openAssignedProspects(db: Db, email: string) {
  return db
    .select()
    .from(prospects)
    .where(
      and(
        eq(prospects.assignedTo, email),
        inArray(prospects.status, [...OPEN_STATUSES]),
        isNull(prospects.mergedInto),
      ),
    );
}
