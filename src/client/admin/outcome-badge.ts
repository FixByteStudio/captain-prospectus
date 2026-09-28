import type { Outcome } from "../../shared/constants";
import { STATUS_BADGE } from "./status";

/**
 * The outcome badge, on Dernières visites and À rattacher — docs/design.md ›
 * Tableau de bord. As in key-a1-dashboard.html: follow_up and converted read
 * as their status badge; the three outcomes with no status colour of their own
 * take ink on a tint plus a 4px edge in the outcome's colour, so the colour is
 * never the only thing that separates them (the label is).
 *
 * Not in `status.ts`, beside `STATUS_BADGE`: the field's StopRow imports that
 * module, so whatever the admin reads from it is bundled into the precached
 * entry chunk (ADR-0026). This map is admin-only and stays in the admin chunk.
 */
export const OUTCOME_BADGE: Readonly<Record<Outcome, string>> = {
  no_contact:
    "bg-secondary text-foreground shadow-[inset_4px_0_0_0_var(--color-outcome-no-contact)]",
  interested:
    "bg-tint-outcome-interested text-foreground shadow-[inset_4px_0_0_0_var(--color-outcome-interested)]",
  not_interested:
    "bg-tint-outcome-not-interested text-foreground shadow-[inset_4px_0_0_0_var(--color-outcome-not-interested)]",
  follow_up: STATUS_BADGE.follow_up,
  converted: STATUS_BADGE.converted,
};
