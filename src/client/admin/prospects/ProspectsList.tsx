import type { Status } from "../../../shared/constants";
import type { Prospect } from "../../../shared/schemas";
import { STATUS_LABELS, TYPE_LABELS, copy } from "../../copy";
import { cn } from "../../lib/utils";
import { Badge } from "../../ui/badge";
import { Checkbox } from "../../ui/checkbox";
import { BADGE_SHAPE, STATUS_BADGE, STATUS_EDGE } from "../status";
import { RowMenu } from "./RowMenu";

/**
 * Below 768px the table becomes a list of rows (Intent, I/O matrix): a
 * checkbox, name, type, status badge, agent, row menu — no table, since a
 * table this narrow either scrolls sideways or drops columns silently.
 */
export function ProspectsList({
  rows,
  selected,
  onToggle,
  agentList,
  onAssign,
  onStatus,
}: {
  rows: Prospect[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  agentList: string[];
  onAssign: (email: string | null, ids: string[]) => void;
  onStatus: (prospect: Prospect, status: Status) => void;
}) {
  return (
    <ul className="divide-border divide-y">
      {rows.map((prospect) => (
        <li
          key={prospect.id}
          className={cn("flex items-center gap-3 px-3.5 py-2.5", STATUS_EDGE[prospect.status])}
        >
          <Checkbox
            checked={selected.has(prospect.id)}
            onCheckedChange={() => onToggle(prospect.id)}
            aria-label={copy.prospects.selection.selectOne(prospect.name)}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{prospect.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {TYPE_LABELS[prospect.type]}
              {prospect.assignedTo ? ` · ${prospect.assignedTo}` : ""}
            </p>
          </div>
          <Badge
            variant="ghost"
            className={cn(BADGE_SHAPE, "shrink-0", STATUS_BADGE[prospect.status])}
          >
            {STATUS_LABELS[prospect.status]}
          </Badge>
          <RowMenu
            prospect={prospect}
            agents={agentList}
            onAssign={(email) => onAssign(email, [prospect.id])}
            onStatus={(status) => onStatus(prospect, status)}
          />
        </li>
      ))}
    </ul>
  );
}
