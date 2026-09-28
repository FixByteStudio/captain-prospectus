import type { ReactNode } from "react";
import { cn } from "../lib/utils";

/**
 * One page heading for every admin screen (GH #175) — a title in the shared
 * `--text-title` token, an optional subtitle, an optional right-aligned
 * action (a button, a count, a toggle group). Replaces each screen's own
 * hand-spelled `text-xl font-semibold tracking-[-0.005em]` heading.
 *
 * A string `subtitle` renders as the muted lede every screen uses. A caller
 * that needs its own classes on that paragraph (ScriptsScreen's `max-w-2xl`)
 * passes its own `<p>` instead.
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
        {typeof subtitle === "string" ? (
          <p className="text-muted-foreground mt-0.5">{subtitle}</p>
        ) : (
          subtitle
        )}
      </div>
      {actions}
    </header>
  );
}
