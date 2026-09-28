import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `touch` sizes the field to the 48px minimum for field screens
 * (ADR-0014 decision 5). shadcn's `md:text-sm` step-down is dropped: every
 * input on both sides stays at 1rem so iOS never zooms (docs/design.md › Type,
 * GH #92).
 */
function Input({
  className,
  type,
  touch = false,
  ...props
}: React.ComponentProps<"input"> & { touch?: boolean }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        // `text-base md:text-base` now repeats the default, kept so a field
        // Input's merged class string stays exactly what it was (GH #186).
        touch && "h-touch px-4 text-base md:text-base",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
