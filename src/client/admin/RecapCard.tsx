import { InfoIcon } from "lucide-react";
import { copy } from "../copy";
import { cn } from "../lib/utils";
import { SidebarFooter } from "../ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useRecap } from "./queries";
import { recapLines } from "./recap";

/**
 * The sidebar's recap card (docs/design.md › Layout): the day's story in small
 * type. No identity and nothing to click; absent while loading or after a
 * failed poll, like the nav badges (`queueCount`), rather than stale. In the
 * rail it is an Info button whose Tooltip and name carry the same lines.
 */
export function RecapCard({ rail }: { rail: boolean }) {
  const recap = useRecap();
  if (!recap.isSuccess) return null;

  const lines = recapLines(recap.data);
  const active = recap.data.activeAgents > 0;

  if (rail) {
    const spoken = [lines.date, lines.agents, lines.visits, lines.received].filter(
      (line): line is string => line !== null,
    );
    return (
      <SidebarFooter className="items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={copy.recap.summary(spoken)}
              className="bg-band-accent ring-band-border text-band-foreground flex size-8 items-center justify-center rounded-md ring-1 ring-inset"
            >
              <InfoIcon aria-hidden="true" className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" align="end">
            <p className="first-letter:uppercase">{lines.date}</p>
            <p className="tnum font-semibold">{lines.agents}</p>
            <p className="tnum">{lines.visits}</p>
            {lines.received && <p>{lines.received}</p>}
          </TooltipContent>
        </Tooltip>
      </SidebarFooter>
    );
  }

  return (
    <SidebarFooter>
      <div data-slot="recap-card" className="bg-band-accent rounded-md px-3 py-2.5 text-xs">
        <p className="text-overline text-band-muted mb-1 uppercase">{lines.date}</p>
        <p className="tnum text-band-foreground flex items-center gap-2 font-medium">
          {/* Not a verdict, and never the only signal: the line beside it says it. */}
          <span
            aria-hidden="true"
            className={cn("size-2 shrink-0 rounded-full", active ? "bg-success" : "bg-band-muted")}
          />
          {lines.agents}
        </p>
        <p className="tnum text-band-foreground pl-4">{lines.visits}</p>
        {lines.received && <p className="text-band-muted pl-4">{lines.received}</p>}
      </div>
    </SidebarFooter>
  );
}
