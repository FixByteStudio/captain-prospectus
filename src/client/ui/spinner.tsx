import type * as React from "react";
import { Loader2Icon } from "lucide-react";
import { copy } from "@/copy";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label={copy.spinner}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
