import type { Outcome } from "../../../shared/constants";

/**
 * Visites dans le temps' colours, per outcome — docs/design.md › Tableau de
 * bord. Their own module so palette.test.ts (rule 7) proves these exact pairs
 * rather than a copy of them.
 *
 * Raw app.css tokens, not `--color-*`: `@theme inline` inlines those into
 * utilities and never declares them, so `var(--color-warn)` resolves to
 * nothing. follow_up and converted reuse warn and success.
 */
export const SERIES_TOKEN: Record<Outcome, string> = {
  no_contact: "--outcome-no-contact",
  interested: "--outcome-interested",
  not_interested: "--outcome-not-interested",
  follow_up: "--warn",
  converted: "--success",
};

/**
 * The count's ink, fixed per theme rather than per series (DESIGN.md rule 7):
 * primary-foreground is navy in light and the dark ink in dark, so no-contact
 * needs no dark: variant; the other four take card in light. `light`/`dark`
 * are the tokens palette.test.ts checks; `className` is what the chart draws.
 */
const ON_CARD = {
  light: "--card",
  dark: "--primary-foreground",
  className: "fill-card dark:fill-primary-foreground",
};
export const SERIES_INK: Record<Outcome, { light: string; dark: string; className: string }> = {
  no_contact: {
    light: "--primary-foreground",
    dark: "--primary-foreground",
    className: "fill-primary-foreground",
  },
  interested: ON_CARD,
  not_interested: ON_CARD,
  follow_up: ON_CARD,
  converted: ON_CARD,
};

/**
 * Dernières visites' outcome badge — docs/design.md › Tableau de bord. As in
 * key-a1-dashboard.html: follow_up and converted read as their status badge;
 * the three outcomes with no status colour of their own take ink on a tint
 * plus a 4px edge in the outcome's colour, so the colour is never the only
 * thing that separates them (the label is).
 */
export const OUTCOME_BADGE: Record<Outcome, string> = {
  no_contact:
    "bg-secondary text-foreground shadow-[inset_4px_0_0_0_var(--color-outcome-no-contact)]",
  interested:
    "bg-tint-outcome-interested text-foreground shadow-[inset_4px_0_0_0_var(--color-outcome-interested)]",
  not_interested:
    "bg-tint-outcome-not-interested text-foreground shadow-[inset_4px_0_0_0_var(--color-outcome-not-interested)]",
  follow_up: "bg-tint-warn text-warn",
  converted: "bg-tint-success text-success",
};
