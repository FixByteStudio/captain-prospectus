/**
 * Row → wire mappers shared by more than one route file.
 *
 * A mapper lives here once two routes need it. The agent sync pull and the
 * admin routes both send prospects and scripts, and must not be able to
 * disagree about what either looks like on the wire.
 */
import type { Prospect, Script } from "../../shared/schemas";
import type { ProspectRow, ScriptRow } from "../db/schema";

export function toWireProspect(row: ProspectRow): Prospect {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    phone: row.phone,
    website: row.website,
    cuisine: row.cuisine,
    source: row.source,
    status: row.status,
    assignedTo: row.assignedTo,
    lastVisitAt: row.lastVisitAt,
    nextVisitAt: row.nextVisitAt,
  };
}

export function toWireScript(row: ScriptRow): Script {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    // Stored as JSON; the shape is guaranteed by scriptCreateSchema on write.
    questions: row.questions as Script["questions"],
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}
