import type { DashboardResponse } from "../../../shared/schemas";
import { STATUS_LABELS, copy } from "../../copy";
import { cn } from "../../lib/utils";
import { STATUS_FILL } from "./status-fill";

type Split = DashboardResponse["openProspectsByStatus"];

const SEGMENTS = ["new", "assigned", "follow_up"] as const satisfies readonly (keyof Split)[];

/**
 * Prospects ouverts' mini-bar — docs/design.md › Tableau de bord: Nouveau,
 * Assigné and À relancer as one 6px stacked bar, with the three labels under
 * it. The bar only shows proportions, so its counts are read out instead.
 */
export function OpenProspectsBar({ split }: { split: Split }) {
  const empty = split.new + split.assigned + split.follow_up === 0;
  return (
    <div>
      {/* The gaps show the card, as in the mockup; the secondary track only
          when there is nothing to split, so the row keeps its shape. */}
      <div
        className={cn("flex h-1.5 gap-0.5 overflow-hidden rounded-full", empty && "bg-secondary")}
        aria-hidden="true"
      >
        {SEGMENTS.map((status) =>
          // A zero segment would still take a gap.
          split[status] > 0 ? (
            <span
              key={status}
              className={STATUS_FILL[status]}
              style={{ flexGrow: split[status] }}
            />
          ) : null,
        )}
      </div>
      <p className="text-meta text-muted-foreground mt-1.5">
        <span aria-hidden="true">{SEGMENTS.map((s) => STATUS_LABELS[s]).join(" · ")}</span>
        <span className="sr-only">
          {copy.dashboard.kpiFooter.openSplit(split.new, split.assigned, split.follow_up)}
        </span>
      </p>
    </div>
  );
}
