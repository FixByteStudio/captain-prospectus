import type { Status } from "../../../shared/constants";

/**
 * A status as a bar's fill (Pipeline par statut, Prospects ouverts' mini-bar),
 * as in key-a1-dashboard.html. Not in `admin/status.ts`: the field's StopRow
 * imports that module, so anything added there ships in the field precache
 * (epic #104, Done when 4).
 */
export const STATUS_FILL: Readonly<Record<Status, string>> = {
  new: "bg-status-new",
  assigned: "bg-status-assigned",
  follow_up: "bg-warn",
  interested: "bg-status-interested",
  converted: "bg-success",
  rejected: "bg-destructive",
};
