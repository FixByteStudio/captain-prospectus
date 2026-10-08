import { MoreVerticalIcon } from "lucide-react";
import type { User } from "../../../shared/schemas";
import { copy } from "../../copy";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

/** The name a user goes by; the break-glass row has none, so the email stands in. */
export function displayName(user: User): string {
  return user.name ?? user.email;
}

/**
 * One row's actions (docs/design.md › Agents). No code or passphrase item:
 * those come with the enrolment stories. The last active admin cannot be
 * demoted or deactivated, and says why under the two items.
 */
export function RowMenu({
  user,
  isLastAdmin,
  onToggleRole,
  onDeactivate,
}: {
  user: User;
  isLastAdmin: boolean;
  onToggleRole: () => void;
  onDeactivate: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={copy.agents.menu(displayName(user))}>
          <MoreVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={isLastAdmin} onSelect={onToggleRole}>
          {user.role === "admin" ? copy.agents.makeAgent : copy.agents.makeAdmin}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={isLastAdmin} onSelect={onDeactivate}>
          {copy.agents.deactivate}
        </DropdownMenuItem>
        {isLastAdmin && (
          <p className="text-muted-foreground text-meta max-w-56 px-2 py-1.5">
            {copy.agents.lastAdmin}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
