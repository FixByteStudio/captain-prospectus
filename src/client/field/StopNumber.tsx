/**
 * The walking-order disc — docs/design.md, "Next-stop card".
 *
 * The number is the stop's own (the swipe's, ADR-0036), never a position in
 * the list. Shared by the next-stop card and every stop row, and reused by
 * Carte and the admin round view (epic-117 context).
 */
import { cn } from "../lib/utils";

export function StopNumber({
  number,
  variant = "default",
}: {
  number: number;
  variant?: "default" | "next";
}) {
  return (
    <span
      className={cn(
        "tnum flex size-8 shrink-0 items-center justify-center rounded-full",
        variant === "next"
          ? "bg-primary text-primary-foreground ring-primary-edge font-bold ring-1 ring-inset"
          : "bg-secondary font-semibold",
      )}
    >
      {number}
    </span>
  );
}
