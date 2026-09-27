import { MoreHorizontalIcon } from "lucide-react";
import { STATUSES } from "../../../shared/constants";
import type { Status } from "../../../shared/constants";
import type { Prospect } from "../../../shared/schemas";
import { STATUS_LABELS, copy } from "../../copy";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

/** The row menu, side submenus kept (Intent: "The row menu keeps its side submenus"). */
export function RowMenu({
  prospect,
  agents,
  onAssign,
  onStatus,
}: {
  prospect: Prospect;
  agents: string[];
  onAssign: (email: string | null) => void;
  onStatus: (status: Status) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={copy.prospects.row.menu(prospect.name)}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{copy.prospects.row.assignTo}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {agents.map((email) => (
              <DropdownMenuItem key={email} onSelect={() => onAssign(email)}>
                {email}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {prospect.assignedTo && (
          <DropdownMenuItem onSelect={() => onAssign(null)}>
            {copy.prospects.row.unassign}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{copy.prospects.row.changeStatus}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {STATUSES.map((status) => (
              <DropdownMenuItem
                key={status}
                disabled={status === prospect.status}
                onSelect={() => onStatus(status)}
              >
                {STATUS_LABELS[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
