/**
 * The two no-tournée gate screens — docs/design.md › Before the swipe. Same
 * shape as the field empty state (a 64px `secondary` disc, a title, one muted
 * paragraph, centred) and no button: the sync runs on its own triggers, so a
 * button would ask the agent to do what is already happening. An admin gets the
 * one way back without a tab bar.
 */
import { InboxIcon, WifiOffIcon } from "lucide-react";
import { Link } from "react-router";
import { copy } from "../copy/field";
import { buttonVariants } from "@/ui/button-variants";

export function NoTourneeMessage({
  kind,
  adminOnline,
}: {
  kind: "neverLoaded" | "nothingAssigned";
  adminOnline: boolean;
}) {
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
      {adminOnline && (
        <Link to="/admin" className={buttonVariants({ variant: "secondary", size: "touch" })}>
          {copy.nav.tabs.dashboard}
        </Link>
      )}
    </div>
  );
}
