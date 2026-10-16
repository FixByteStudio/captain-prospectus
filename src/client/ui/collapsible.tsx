import type * as React from "react";
import * as CollapsiblePrimitive from "radix-ui/collapsible";

/**
 * Vendored for the Visites ledger's door-day rows (ADR-0036 R13, design.md
 * › The live feed): a row opens in place onto its visits. The trigger carries
 * `aria-expanded` and `aria-controls` itself. Ships no English string, so
 * there is nothing here to translate (ADR-0014).
 */
function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return <CollapsiblePrimitive.CollapsibleTrigger data-slot="collapsible-trigger" {...props} />;
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return <CollapsiblePrimitive.CollapsibleContent data-slot="collapsible-content" {...props} />;
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
