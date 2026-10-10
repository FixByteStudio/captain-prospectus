import * as React from "react";
import { cn } from "@/lib/utils";
import * as ProgressPrimitive from "radix-ui/progress";

/**
 * `ink` is the admin import's bar: gold progress is reserved for the field's
 * daily progress and Taux de conversion (docs/design.md › The CSV import).
 */
function Progress({
  className,
  value,
  variant = "gold",
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { variant?: "gold" | "ink" }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full",
        variant === "ink" ? "bg-foreground/15" : "bg-primary/20",
        className,
      )}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        // shadow-[inset...primary-edge]: the fill is 2.2:1 against the page, so
        // without its own edge the bar has no discernible boundary (WCAG
        // 1.4.11) — an inset shadow rather than a border, since the track's
        // overflow-hidden already clips it to the rounded shape (sidebar.tsx's
        // active item is the same idiom).
        className={cn(
          "h-full w-full flex-1 transition-all",
          // The ink fill is 14:1 against the page, so it needs no edge.
          variant === "ink"
            ? "bg-foreground"
            : "bg-primary shadow-[inset_0_0_0_1px_var(--primary-edge)]",
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
