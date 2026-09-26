import type { ReactNode } from "react";
import { Link } from "react-router";
import { Clock, Copy, Link as LinkIcon, type LucideIcon } from "lucide-react";
import { copy } from "../../copy";
import { formatCount } from "../../format";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { prospectsHref } from "../queries";

const SHELL = "min-w-0 gap-0 p-4.5";

type Row = {
  icon: LucideIcon;
  label: string;
  meta: string;
  /** `undefined` while its query loads or after it failed: never a guessed 0. */
  count: number | undefined;
  format?: (n: number) => string;
  action: string;
  to: string;
};

/**
 * À traiter — docs/design.md › Tableau de bord, GH #113.
 *
 * Relances dues comes from the dashboard; the two queues from the queries the
 * sidebar already runs, so no request of its own. A row with nothing to do, or no number yet, is muted and its button
 * disabled: a link to an empty queue is a click for nothing.
 */
export function TodoPanel({
  followUpsDue,
  dueBefore,
  orphans,
  duplicates,
}: {
  followUpsDue: number | undefined;
  /** The dashboard's `to`: the list behind Voir counts exactly `followUpsDue`. */
  dueBefore: number;
  orphans: number | undefined;
  duplicates: number | undefined;
}) {
  const t = copy.dashboard.todo;
  const rows: Row[] = [
    {
      icon: Clock,
      label: t.followUps,
      meta: t.followUpsMeta,
      count: followUpsDue,
      action: t.followUpsAction,
      to: prospectsHref({ status: ["follow_up"], dueBefore }),
    },
    {
      icon: LinkIcon,
      label: t.orphans,
      meta: t.orphansMeta,
      count: orphans,
      action: t.orphansAction,
      to: "/admin/a-rattacher",
    },
    {
      icon: Copy,
      label: t.duplicates,
      meta: t.duplicatesMeta,
      count: duplicates,
      format: t.pairs,
      action: t.duplicatesAction,
      to: "/admin/doublons",
    },
  ];

  return (
    <Card className={SHELL}>
      <h3 className="text-heading mb-1">{t.title}</h3>
      <ul className="divide-border divide-y">
        {rows.map((row) => (
          <TodoRow key={row.label} row={row} />
        ))}
      </ul>
    </Card>
  );
}

function TodoRow({ row }: { row: Row }) {
  const active = row.count !== undefined && row.count > 0;
  const figure: ReactNode = row.count === undefined ? "—" : (row.format ?? formatCount)(row.count);
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className="bg-secondary grid size-10 flex-none place-items-center rounded-lg"
        aria-hidden="true"
      >
        <row.icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{row.label}</span>
        <span className="text-meta text-muted-foreground block">{row.meta}</span>
      </span>
      <span
        className={cn(
          "tnum text-base font-semibold whitespace-nowrap",
          !active && "text-muted-foreground",
        )}
      >
        {figure}
      </span>
      {active ? (
        <Button asChild variant="secondary" size="sm">
          <Link to={row.to}>{row.action}</Link>
        </Button>
      ) : (
        <Button variant="secondary" size="sm" disabled>
          {row.action}
        </Button>
      )}
    </li>
  );
}

export function TodoPanelSkeleton() {
  return (
    <Card className={`${SHELL} gap-3`} aria-hidden="true">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </Card>
  );
}
