import type { ReactNode } from "react";
import { cn } from "../lib/utils";

/**
 * One page heading for every admin screen (GH #175) — a title in the shared
 * `--text-title` token, an optional subtitle, an optional right-aligned
 * action (a button, a count, a toggle group). Replaces each screen's own
 * hand-spelled `text-xl font-semibold tracking-[-0.005em]` heading.
 *
 * `subtitle` is a `ReactNode`, not a string: a caller that had its own
 * classes on that paragraph (e.g. ScriptsScreen's lede) passes its own `<p>`
 * rather than lose them to this component's default styling.
 */
export function ScreenHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-4",
        // A subtitle stacks under the title, so the title/subtitle block's
        // own box — not its text baseline — is what should line up with the
        // actions beside it (docs/design.md's DashboardScreen header shape).
        subtitle && "items-end",
        className,
      )}
    >
      <div>
        <h2 className="text-title">{title}</h2>
        {subtitle}
      </div>
      {actions}
    </header>
  );
}
