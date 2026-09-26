import type { DashboardResponse } from "../../../shared/schemas";
import { copy } from "../../copy";
import { formatCount } from "../../format";
import { Card } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";

type Agent = DashboardResponse["agents"][number];

const SHELL = "min-w-0 gap-3 overflow-hidden pt-4.5 pb-1.5";
const HEAD =
  "text-overline text-muted-foreground h-auto px-3 py-2 align-bottom leading-tight whitespace-normal uppercase";
const NUMBER = "tnum px-2 text-right last:pr-3";

/**
 * Activité par agent — docs/design.md › Tableau de bord, GH #112.
 *
 * There is no users table (ADR-0006), so a row is the email and its initial.
 * Rows are not links yet (story 10). `Table` scrolls sideways at 390 px.
 */
export function AgentActivityTable({ agents }: { agents: Agent[] }) {
  const t = copy.dashboard.agents;
  return (
    <Card className={SHELL}>
      <h3 className="text-heading px-4.5">{t.title}</h3>
      {agents.length === 0 ? (
        <p className="text-muted-foreground px-4.5 pb-3">{t.empty}</p>
      ) : (
        <Table>
          <TableHeader className="bg-secondary">
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className={HEAD}>
                {t.agent}
              </TableHead>
              <TableHead scope="col" className={`${HEAD} text-right`}>
                {t.visits}
              </TableHead>
              <TableHead scope="col" className={`${HEAD} text-right`}>
                {t.converted}
              </TableHead>
              <TableHead scope="col" className={`${HEAD} text-right`}>
                {t.followUp}
              </TableHead>
              <TableHead scope="col" className={`${HEAD} text-right`}>
                {t.openProspects}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((a) => (
              <TableRow key={a.email} className="h-row hover:bg-transparent">
                <TableHead scope="row" className="pr-2 pl-3 font-normal">
                  <span className="inline-flex items-center gap-2.5">
                    <span
                      className="bg-secondary grid size-6.5 place-items-center rounded-full text-meta font-semibold"
                      aria-hidden="true"
                    >
                      {a.email.charAt(0).toUpperCase()}
                    </span>
                    {a.email}
                  </span>
                </TableHead>
                <TableCell className={NUMBER}>{formatCount(a.visits)}</TableCell>
                <TableCell className={`${NUMBER} text-success font-semibold`}>
                  {formatCount(a.converted)}
                </TableCell>
                <TableCell className={`${NUMBER} text-warn font-semibold`}>
                  {formatCount(a.followUp)}
                </TableCell>
                <TableCell className={NUMBER}>{formatCount(a.openProspects)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

export function AgentActivityTableSkeleton() {
  return (
    <Card className={`${SHELL} px-4.5`} aria-hidden="true">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-row w-full" />
      <Skeleton className="h-row w-full" />
    </Card>
  );
}
