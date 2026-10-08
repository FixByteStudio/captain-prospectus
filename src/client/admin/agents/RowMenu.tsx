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
 * One row's actions (docs/design.md › Agents). "Générer un code" comes first,
 * on every active row, the admin's own included; "Nouvelle phrase de passe"
 * follows only when `onNewPassphrase` is given, which the caller does for the
 * signed-in admin's own row alone. The last active admin cannot be demoted or
 * deactivated, and says why under the two items.
 */
export function RowMenu({
  user,
  isLastAdmin,
  onGenerateCode,
  onNewPassphrase,
  onToggleRole,
  onDeactivate,
}: {
  user: User;
  isLastAdmin: boolean;
  onGenerateCode: () => void;
  onNewPassphrase?: () => void;
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
        <DropdownMenuItem onSelect={onGenerateCode}>{copy.agents.generateCode}</DropdownMenuItem>
        {onNewPassphrase && (
          <DropdownMenuItem onSelect={onNewPassphrase}>
            {copy.agents.newPassphrase}
          </DropdownMenuItem>
        )}
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
