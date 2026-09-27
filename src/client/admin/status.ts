import type { Status } from "../../shared/constants";

/**
 * How a status looks in the ledger — docs/design.md.
 *
 * Status is read down a row's leading edge before it is read as a word, so each
 * one owns an edge colour and a label colour. The ramp is deliberate: `new` is
 * the quietest thing in the column because nothing has happened there yet, and
 * `assigned` is a mid-neutral so that "someone owes a visit" never outshouts
 * "we won this one".
 *
 * Colour never carries the information alone. The French label from
 * STATUS_LABELS is always in its own column too.
 */
export const STATUS_EDGE: Readonly<Record<Status, string>> = {
  new: "shadow-[inset_4px_0_0_0_var(--color-status-new)]",
  assigned: "shadow-[inset_4px_0_0_0_var(--color-status-assigned)]",
  follow_up: "shadow-[inset_4px_0_0_0_var(--color-status-follow-up)]",
  converted: "shadow-[inset_4px_0_0_0_var(--color-status-converted)]",
  rejected: "shadow-[inset_4px_0_0_0_var(--color-status-rejected)]",
};

/**
 * `converted` is `success`, never `primary`. The brand colour is gold, and gold
 * sits 7° in hue from the mustard that means `follow_up` — a converted prospect
 * and one that needs chasing would stop being separable at a glance.
 */
export const STATUS_TEXT: Readonly<Record<Status, string>> = {
  new: "text-muted-foreground",
  assigned: "text-foreground font-medium",
  follow_up: "text-warn font-medium",
  converted: "text-success font-medium",
  rejected: "text-destructive font-medium",
};

/** The badge's shape, as `RecentVisits.tsx`'s own: `rounded-sm`, meta type. */
export const BADGE_SHAPE = "text-meta rounded-sm px-2 font-medium tracking-[0.02em]";

/**
 * The status badge (docs/design.md › Badges): a tinted rectangle, the fill
 * mixed at most 12 % into the card (`tint-*`). Prospects shows it beside the
 * leading edge, so the colour never carries the status alone.
 */
export const STATUS_BADGE: Readonly<Record<Status, string>> = {
  new: "bg-secondary text-muted-foreground",
  assigned: "bg-tint-assigned text-foreground",
  follow_up: "bg-tint-warn text-warn",
  converted: "bg-tint-success text-success",
  rejected: "bg-tint-destructive text-destructive",
};
