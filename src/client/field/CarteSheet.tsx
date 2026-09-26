/**
 * The persistent Carte sheet, phone only — docs/design.md, "Carte"
 * (spec-gh-122). DESIGN.md's `bottom-sheet` token, but a plain `<section>`,
 * never shadcn `Sheet`: `Sheet` is a Radix dialog that traps focus, dims the
 * screen and closes on any outside pointer — including a pin tap, the one
 * interaction meant to update this panel, not dismiss it (Design Notes).
 *
 * Shares `StopNumber`, `NotSyncedBadge`, `Distance` and `StopActions` with
 * Tournée and `CarteList`, so a stop can never read differently on the two
 * screens.
 */
import { StopNumber } from "./StopNumber";
import { NotSyncedBadge, StopActions, Distance } from "./StopRow";
import { copy, TYPE_LABELS } from "../copy";
import { cn } from "../lib/utils";
import type { TodayItem } from "./today";

export function CarteSheet({ item, index }: { item: TodayItem | null; index: number }) {
  return (
    <section
      aria-label={copy.carte.sheetLabel}
      // `-mt-3 relative z-10`: overlaps the map above it by 12px for the
      // rounded top corners, in flow rather than laid over it — so the
      // attribution line and the re-centre control, drawn inside the map's
      // own (shorter, `flex-1`) box, never need their height measured
      // against this panel's own (Design Notes, "In flow, not overlaid").
      className={cn(
        "bg-card relative z-10 -mt-3 rounded-t-xl px-4 pt-2 pb-3.5",
        // A token-built shadow, not a hardcoded colour: `--color-foreground`
        // is the ink in both themes, so the sheet's own elevation follows
        // dark mode the same way `readToken` does for the map's path.
        "shadow-[0_-6px_24px_-4px_color-mix(in_oklab,var(--color-foreground)_20%,transparent)]",
      )}
    >
      {/* Decorative: the sheet is persistent, never dragged or dismissed. */}
      <div aria-hidden="true" className="bg-border mx-auto mb-2.5 h-1 w-9 rounded-full" />

      {!item ? (
        <p className="text-muted-foreground py-2 text-center">{copy.today.empty}</p>
      ) : (
        <>
          {/* `aria-live` on the whole row: a pin tap changes the number, the
              name/meta/badge and the distance together with no navigation, so
              a screen-reader user needs all of it announced, not just the
              name. */}
          <div aria-live="polite" className="flex items-start gap-3">
            <StopNumber index={index} variant={index === 1 ? "next" : "default"} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{item.name}</p>
              <p className="text-muted-foreground text-meta truncate">
                {copy.today.meta(TYPE_LABELS[item.type], item.address)}
              </p>
              <NotSyncedBadge item={item} />
            </div>
            <p className="shrink-0">
              <Distance item={item} className="text-base font-semibold" />
            </p>
          </div>

          <StopActions item={item} className="mt-3" />
        </>
      )}
    </section>
  );
}
