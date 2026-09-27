import type { Status } from "../../../shared/constants";
import type { Prospect } from "../../../shared/schemas";
import { STATUS_LABELS, TYPE_LABELS, copy } from "../../copy";
import { formatDate } from "../../format";
import { cn } from "../../lib/utils";
import { Badge } from "../../ui/badge";
import { Checkbox } from "../../ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { BADGE_SHAPE, STATUS_BADGE, STATUS_EDGE } from "../status";
import { RowMenu } from "./RowMenu";

/** An empty cell is a dash, never a blank — a blank reads as a rendering bug. */
function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

/** The ≥768px table — a ledger, status as edge and badge (docs/design.md › Prospects). */
export function ProspectsTable({
  rows,
  selected,
  allSelected,
  onToggle,
  onToggleAll,
  agentList,
  onAssign,
  onStatus,
}: {
  rows: Prospect[];
  selected: Set<string>;
  allSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  agentList: string[];
  onAssign: (email: string | null, ids: string[]) => void;
  onStatus: (prospect: Prospect, status: Status) => void;
}) {
  return (
    <Table className="[&_td]:h-row [&_td]:py-0">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10 pl-3.5">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleAll}
              disabled={rows.length === 0}
              aria-label={copy.prospects.selection.selectAll}
            />
          </TableHead>
          <TableHead className="w-full min-w-48">{copy.prospects.columns.name}</TableHead>
          <TableHead>{copy.prospects.columns.type}</TableHead>
          <TableHead>{copy.prospects.columns.address}</TableHead>
          <TableHead>{copy.prospects.columns.status}</TableHead>
          <TableHead>{copy.prospects.columns.agent}</TableHead>
          <TableHead className="text-right">{copy.prospects.columns.lastVisit}</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((prospect) => (
          <TableRow
            key={prospect.id}
            data-state={selected.has(prospect.id) ? "selected" : undefined}
            // Selection is gold throughout — the toolbar and the rows it
            // refers to. shadcn's default paints selected rows muted grey,
            // which reads as unrelated to the gold bar above them.
            className="data-[state=selected]:bg-primary/10"
          >
            <TableCell className={cn("pl-3.5", STATUS_EDGE[prospect.status])}>
              <Checkbox
                checked={selected.has(prospect.id)}
                onCheckedChange={() => onToggle(prospect.id)}
                aria-label={copy.prospects.selection.selectOne(prospect.name)}
              />
            </TableCell>
            <TableCell className="font-medium">{prospect.name}</TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap">
              {TYPE_LABELS[prospect.type]}
            </TableCell>
            <TableCell className="text-muted-foreground">{prospect.address ?? <Empty />}</TableCell>
            <TableCell>
              <Badge variant="ghost" className={cn(BADGE_SHAPE, STATUS_BADGE[prospect.status])}>
                {STATUS_LABELS[prospect.status]}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {prospect.assignedTo ?? <Empty />}
            </TableCell>
            <TableCell className="text-muted-foreground tnum text-right whitespace-nowrap">
              {prospect.lastVisitAt ? formatDate(prospect.lastVisitAt) : <Empty />}
            </TableCell>
            <TableCell>
              <RowMenu
                prospect={prospect}
                agents={agentList}
                onAssign={(email) => onAssign(email, [prospect.id])}
                onStatus={(status) => onStatus(prospect, status)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
