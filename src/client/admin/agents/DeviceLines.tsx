import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { Device } from "../../../shared/schemas";
import { copy } from "../../copy";
import { formatDateTime, formatShortDate } from "../../format";
import { Button } from "../../ui/button";

const t = copy.agents.devices;

/** The chevron before an active row's name that opens its device lines. */
export function ExpandButton({
  name,
  expanded,
  onToggle,
}: {
  name: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={t.expand(name)}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
    </Button>
  );
}

/**
 * One user's devices (docs/design.md › Agents): label, enrolment and last-seen
 * dates in meta, then "Révoquer" — or "Cet appareil" for the session this page
 * is open on, which signs out through the avatar menu instead. `table` keeps
 * each line on one row; `list` (below 768px) wraps the dates under the label.
 */
export function DeviceLines({
  devices,
  variant,
  revoking,
  onRevoke,
}: {
  devices: Device[];
  variant: "table" | "list";
  /** Ids whose revoke is in flight: their button is disabled. */
  revoking: Set<string>;
  onRevoke: (device: Device) => void;
}) {
  if (devices.length === 0) {
    return <p className="text-muted-foreground text-meta py-1">{t.none}</p>;
  }
  return (
    <ul className="flex flex-col">
      {devices.map((device) => {
        const name = device.label ?? t.unknown;
        const label = <span className="truncate">{name}</span>;
        const enrolled = t.enrolledOn(formatShortDate(device.createdAt));
        const seen = t.seenOn(formatDateTime(device.lastSeenAt));
        const action = device.current ? (
          <span className="text-muted-foreground text-meta">{t.current}</span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.revokeLabel(name)}
            disabled={revoking.has(device.id)}
            onClick={() => onRevoke(device)}
          >
            {t.revoke}
          </Button>
        );
        return variant === "table" ? (
          <li key={device.id} className="flex min-h-8 items-center gap-4">
            <span className="flex w-48 min-w-0">{label}</span>
            <span className="text-muted-foreground text-meta tnum">{enrolled}</span>
            <span className="text-muted-foreground text-meta tnum">{seen}</span>
            <span className="ml-auto">{action}</span>
          </li>
        ) : (
          <li key={device.id} className="flex flex-col py-1">
            {label}
            <div className="flex min-h-8 items-center gap-3">
              <span className="text-muted-foreground text-meta tnum">
                {enrolled} · {seen}
              </span>
              <span className="ml-auto">{action}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
