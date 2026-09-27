import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

/**
 * The admin panel chrome as one component (GH #175) — the border and fill
 * every hand-spelled panel already repeats (e.g. import/SourceStep.tsx,
 * scripts/ScriptsScreen.tsx): `border-border bg-card rounded-md border`, no
 * padding, since these wrap a `<ul>` of divided rows, not a padded card.
 * Deliberately not built on `ui/card.tsx`: that component is dashboard-only
 * — docs/design.md rules cards out on the admin side — and it also carries
 * `rounded-xl` and its own padding, which is the wrong shape here. Named
 * `Surface`, not `Panel`: `PipelinePanel`/`TodoPanel` are content panels, and
 * the name would collide. The twelve hand-spelled panel sites (ProspectsScreen
 * has two, its split panel) keep their own chrome for now — see
 * `_bmad-output/implementation-artifacts/deferred-work.md` — and each screen's
 * own rebuild story adopts this.
 */
export function Surface({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("border-border bg-card rounded-md border", className)} {...props} />;
}
