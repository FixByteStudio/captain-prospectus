/**
 * The two no-tournée gate screens — docs/design.md › Before the swipe. Same
 * shape as the field empty state (a 64px `secondary` disc, a title, one muted
 * paragraph, centred) and no button: the sync runs on its own triggers, so a
 * button would ask the agent to do what is already happening.
 */
import { InboxIcon, WifiOffIcon } from "lucide-react";
import { copy } from "../copy/field";

export function NoTourneeMessage({ kind }: { kind: "neverLoaded" | "nothingAssigned" }) {
  const never = kind === "neverLoaded";
  const Icon = never ? WifiOffIcon : InboxIcon;

  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <span className="bg-secondary text-muted-foreground flex size-16 items-center justify-center rounded-xl">
        <Icon aria-hidden className="size-7" />
      </span>
      <div className="space-y-1">
        <h2 className="text-heading">
          {never ? copy.start.neverLoadedTitle : copy.start.nothingAssignedTitle}
        </h2>
        <p className="text-muted-foreground text-base">
          {never ? copy.start.neverLoadedBody : copy.start.nothingAssignedBody}
        </p>
      </div>
    </div>
  );
}
