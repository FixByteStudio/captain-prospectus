---
name: Captain Prospectus
description: Field-canvassing app for Brussels, with an admin dashboard and an offline-first field PWA. Built on shadcn/ui + Tailwind CSS v4; this file specifies the brand layer on top of shadcn's defaults.
status: final
updated: 2026-09-26
sources:
  - .memlog.md
  - stitch/ (Stitch exports, light mode only; see "Sources and mockups")
  - src/client/styles/app.css
  - docs/design.md
colors:
  # Light values, then the dark counterpart with a -dark suffix. Dark follows the
  # system and can be pinned with data-theme on <html> (unchanged from app.css).
  background: '#F6F7F0'
  background-dark: '#101726'
  card: '#FFFFFF'
  card-dark: '#182031'
  foreground: '#1B2A4A'
  foreground-dark: '#E7EAF0'
  secondary: '#E8EAEF'            # also muted and accent
  secondary-dark: '#222B3D'
  muted-foreground: '#5A6478'
  muted-foreground-dark: '#97A2B8'
  border: '#D7DAE2'               # also input
  border-dark: '#2B3547'
  primary: '#C9A227'              # gold
  primary-dark: '#D9B43C'
  primary-foreground: '#1B2A4A'
  primary-foreground-dark: '#141C2E'
  primary-edge: '#A8801A'
  primary-edge-dark: '#E6C65C'
  ring: '#1B2A4A'
  ring-dark: '#E7EAF0'
  success: '#1F6F4A'
  success-dark: '#4FA97D'
  warn: '#9A6B12'
  warn-dark: '#D98A3C'
  destructive: '#8C2F39'
  destructive-dark: '#D2757E'
  on-destructive: '#FFFFFF'
  on-destructive-dark: '#141C2E'
  band: '#1B2A4A'                 # admin sidebar + field top band
  band-dark: '#0B1120'
  band-foreground: '#EEF0F4'
  band-foreground-dark: '#E7EAF0'
  band-muted: '#95A0B8'
  band-muted-dark: '#7D899F'
  band-accent: '#FFFFFF14'        # NEW: hover wash on the band (8 %)
  band-accent-dark: '#FFFFFF0F'   # 6 %
  band-border: '#FFFFFF1F'        # NEW: hairlines on the band (12 %)
  band-border-dark: '#FFFFFF14'   # 8 %
  # Status edges. In app.css these are color-mix(foreground, transparent); the hex
  # shown is the result over the card.
  status-new: '#DADCE2'           # 16 % ink
  status-new-dark: '#394050'
  status-assigned: '#828A9B'      # 55 % ink
  status-assigned-dark: '#8A8F9A'
  # NEW: one colour per visit outcome, for charts and admin outcome badges.
  # Every value reaches 3:1 against the card of its own theme (card in light,
  # card-dark in dark) per WCAG 1.4.11; that ratio follows each line. Series are
  # NOT 3:1 against each other — five mutually-distinct series would need an 81:1
  # luminance range and sRGB has 21:1. Adjacency in the stacked chart is broken
  # structurally instead; see Components › Charts. Each value also carries its
  # in-segment count label at 4.5:1, which is what fixes the darks at their level.
  outcome-no-contact: '#8A92A4'        # 3.12
  outcome-no-contact-dark: '#7C87A0'   # 4.52
  outcome-interested: '#2E3F63'        # 10.46
  outcome-interested-dark: '#AEBBDB'   # 8.47
  outcome-not-interested: '#5B5F63'    # 6.44
  outcome-not-interested-dark: '#8E9399' # 5.26
  # outcome follow_up → {colors.warn} (4.68 / 5.93);
  # outcome converted → {colors.success} (6.12 / 5.66)
typography:
  display:
    fontFamily: Archivo Variable
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.01em
  title:
    fontFamily: Archivo Variable
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.005em
  heading:
    fontFamily: Archivo Variable
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.4'
  body-field:
    fontFamily: Archivo Variable
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body:
    fontFamily: Archivo Variable
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.45'
  label:
    fontFamily: Archivo Variable
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.3'
  meta:
    fontFamily: Archivo Variable
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.35'
    letterSpacing: 0.02em
  overline:
    fontFamily: Archivo Variable
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.35'
    letterSpacing: 0.06em
rounded:
  sm: 4px        # badges, stop numbers' inner chips, checkboxes
  DEFAULT: 6px   # = --radius (0.375rem); buttons, inputs, selects
  md: 6px
  lg: 8px        # popovers, menus, map controls
  xl: 12px       # cards, dialogs, bottom sheet top corners
  full: 9999px   # dots, avatars, stop numbers, tab pill
spacing:
  # Tailwind's 4-based scale is inherited. Named tokens:
  touch: 48px          # --spacing-touch: every field target
  decision: 56px       # --spacing-decision: minimum height of an outcome card
  row: 44px            # --spacing-row: an admin table row
  sidebar: 16rem       # shadcn Sidebar default (Stitch drew 260px)
  sidebar-collapsed: 3rem
  band-height: 56px    # field top band, not counting safe-area-top
  tab-bar-height: 64px # field bottom tabs, not counting safe-area-bottom
  page-margin: 32px    # admin content, ≥ lg
  page-margin-compact: 16px  # admin < md, and all field screens
  panel-gap: 24px      # between dashboard cards and panels
  stack-gap: 12px      # between field rows and cards
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    border: '1px solid {colors.primary-edge}'
    radius: '{rounded.md}'
    height-admin: 36px
    height-field: '{spacing.touch}'
  button-secondary:
    background: '{colors.secondary}'
    foreground: '{colors.foreground}'
    radius: '{rounded.md}'
  button-destructive:
    background: '{colors.destructive}'
    foreground: '{colors.on-destructive}'
    radius: '{rounded.md}'
  card:
    background: '{colors.card}'
    border: '1px solid {colors.border}'
    shadow: 'shadcn shadow-sm'
    radius: '{rounded.xl}'
  kpi-card:
    extends: card
    label: '{typography.overline} in {colors.muted-foreground}'
    figure: '{typography.display}, tabular figures'
    delta-up: '{colors.success} on a success tint'
    delta-down: '{colors.destructive} on a destructive tint'
  status-badge:
    radius: '{rounded.sm}'
    typography: '{typography.meta}'
    foreground: 'the status label colour (see Colors)'
    background: 'status colour mixed ≤ 12 % into {colors.card}'
  outcome-badge:
    radius: '{rounded.sm}'
    typography: '{typography.meta}'
    # Unlike status-badge, the label is ink, not the outcome colour: the outcome
    # set is tuned for 3:1 as a chart fill, and the lighter members cannot also
    # carry 4.5:1 text on their own tint ({colors.outcome-no-contact} on its 12 %
    # tint is 2.79:1). Ink clears 11.5:1 on every tint in both themes.
    foreground: '{colors.foreground}'
    background: 'outcome colour mixed ≤ 12 % into {colors.card}'
    edge: '4px inset in the outcome colour, so the colour is still present'
  ledger-row:
    height: '{spacing.row}'
    status-edge: '4px inset on the first cell'
  nav-item-active:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  sidebar:
    background: '{colors.band}'
    foreground: '{colors.band-foreground}'
    group-label: '{typography.overline} in {colors.band-muted}'
    hover: '{colors.band-accent}'
  top-bar:
    background: '{colors.card}'
    border-bottom: '1px solid {colors.border}'
    height: 56px
  field-band:
    background: '{colors.band}'
    foreground: '{colors.band-foreground}'
    height: '{spacing.band-height}'
  tab-bar:
    background: '{colors.card}'
    border-top: '1px solid {colors.border}'
    height: '{spacing.tab-bar-height}'
    label: '{typography.meta}'
  tab-active:
    indicator: 'pill behind the icon, {colors.primary} fill, icon in {colors.primary-foreground}'
  next-stop-card:
    extends: card
    edge: '4px left, {colors.primary}'
  stop-number:
    size: 32px
    radius: '{rounded.full}'
    next: '{colors.primary} fill, {colors.primary-foreground} numeral'
    other: '{colors.secondary} fill, {colors.foreground} numeral'
  outcome-card:
    min-height: '{spacing.decision}'
    background: '{colors.card}'
    border: '1px solid {colors.border}'
    radius: '{rounded.xl}'
    icon-tile: '{colors.secondary}, 40px, {rounded.lg}'
  outcome-card-selected:
    border: '2px solid {colors.primary-edge}'
    background: '{colors.primary} mixed 12 % into {colors.card}'
    icon-tile: '{colors.primary} fill, icon in {colors.primary-foreground}'
    check: '{colors.primary} disc with a {colors.primary-foreground} check'
  choice-selected:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    border: '1px solid {colors.primary-edge}'
  sync-strip:
    height: 32px
    typography: '{typography.meta}'
  bottom-sheet:
    background: '{colors.card}'
    radius: '{rounded.xl} top corners'
    handle: '36×4px, {colors.border}'
  map-pin-next:
    fill: '{colors.primary}'
    numeral: '{colors.primary-foreground}'
  map-pin:
    fill: '{colors.card}'
    numeral: '{colors.foreground}'
  map-position:
    dot: '{colors.foreground}, 12px, with a 24px {colors.foreground} halo at 20 %'
---

## Brand & Style

Captain Prospectus replaces a *carnet de tournée*, the paper notebook of addresses, ticks and scribbled outcomes that field agents carried. The mark is a ship's wheel around a map pin. Navy is the ink. Gold is where you are heading: the action to take, and whatever you have just chosen.

The product has two faces with the same palette and typeface.

- **The admin side is a dashboard.** It is a quiet version of the shadcn "SaaS dashboard" demos. A navy sidebar holds the navigation. Content cards show KPI figures with deltas and sparklines, chart panels, tables and action queues. The figures that say how canvassing is going come first; lists sit under them. It is built for a laptop and still works on a tablet or a phone.
- **The field side is the page torn out of that notebook.** An agent stands on a pavement in Brussels with a phone in one hand and flyers in the other, sun on the screen and often no signal. The field side keeps the admin's tokens but has bigger type, bigger targets, and one decision per screen.

The system is shadcn/ui, vendored into `src/client/ui/` (ADR-0014). This file specifies only the brand layer: colour overrides, one typeface, a slightly tighter radius, and the app's own components. Every shadcn component not listed under Components keeps shadcn's default visual spec.

`src/client/styles/app.css` is the implementation. When a token here differs from it, this file is the target and `app.css` changes at build. The new tokens are `band-accent`, `band-border`, the `outcome-*` set and the badge tint.

## Colors

- **Navy `{colors.foreground}`** is the ink: text, icons, and the focus ring. As `{colors.band}` it also fills the admin sidebar and the field top band.
- **Gold `{colors.primary}`** has two jobs and no others. It marks **the main action** on a view (Visiter, Continuer, Enregistrer, Importer, Mettre à jour). It also marks **what is selected**: the current sidebar item, the current tab, the chosen outcome card, a chosen answer, chip or rating, and the next stop. Gold is always a fill, with navy `{colors.primary-foreground}` on top and a 1px `{colors.primary-edge}` border.
- **Off-white `{colors.background}`** is the page. **White `{colors.card}`** holds cards, tables, sheets and dialogs.
- **`{colors.secondary}`** fills secondary buttons, icon tiles, skeletons and unselected choice tiles. `{colors.muted-foreground}` is for meta text, help text and column headers.
- **Status colours** (the status of a prospect):

  | Status | Edge | Label and badge text | Badge fill |
  |---|---|---|---|
  | Nouveau | `{colors.status-new}` | `{colors.muted-foreground}` | secondary |
  | Assigné | `{colors.status-assigned}` | `{colors.foreground}` | 12 % assigned tint |
  | À relancer | `{colors.warn}` | `{colors.warn}` | 12 % warn tint |
  | Converti | `{colors.success}` | `{colors.success}` | 12 % success tint |
  | Refusé | `{colors.destructive}` | `{colors.destructive}` | 12 % destructive tint |

  Converti is **always** green. It is never gold: gold sits 7° in hue from the mustard that means À relancer, and the two would stop being separable.
- **Outcome colours** (the result of a visit), used on the admin side only, for the stacked "Visites dans le temps" chart and for outcome badges. Personne sur place is `{colors.outcome-no-contact}`, Intéressé `{colors.outcome-interested}`, Pas intéressé `{colors.outcome-not-interested}`, À relancer `{colors.warn}` and Converti `{colors.success}`. The field visit form **never** shows these colours: the outcome cards look neutral until one is selected (see EXPERIENCE.md, invariant 3).

  All five reach **3:1 against `{colors.card}`** in both themes, so each is a legible graphical object on its own. They are deliberately **not** 3:1 against each other: five mutually-distinguishable series would need an 81:1 luminance range and sRGB offers 21:1, so no five-colour palette can do it. The stacked chart therefore separates neighbours structurally rather than chromatically — a 1px `{colors.card}` stroke between segments plus the count printed in the segment (see Components, Charts). Ordering the three navy/neutral tokens by lightness (no-contact lightest, Intéressé darkest in light and lightest in dark) keeps the stack readable as a gradient even where two series sit close. Both themes and the full ratio table are in [`mockups/key-a1-outcome-chart.html`](mockups/key-a1-outcome-chart.html).
- **Deltas** are `{colors.success}` when up and `{colors.destructive}` when down, each with an arrow and a signed figure. The colour never carries the meaning alone.

**Rules asserted in `palette.test.ts`.** Changing a hex so that one of these breaks fails CI.

1. Gold is never text on a light surface: it is 2.4:1 on white.
2. Text on gold is navy, never white. Navy gives 5.9:1; white gives 2.4:1.
3. Gold is never the focus ring. `{colors.ring}` is ink.
4. Every gold fill carries `{colors.primary-edge}` (3.4:1 against the page, for WCAG 1.4.11).
5. Status and outcome badge text on its tint reaches 4.5:1. If a tint fails, it drops below 12 % until it passes. Outcome badges reach it by using ink for the label rather than the outcome colour (see `{components.outcome-badge}`); the outcome colour survives as the 4px edge. Dropping the tint alone could not fix them — `{colors.outcome-no-contact}` is only 3.12:1 on white, so no tint of it carries its own label.
6. Every `outcome-*` colour, plus `{colors.warn}` and `{colors.success}`, reaches 3:1 against the card **of its own theme** — light values against `{colors.card}`, dark values against `{colors.card-dark}`. Asserting a dark value against `{colors.card}` is a bug: `{colors.outcome-interested-dark}` on white is 1.92:1. This is the rule issue #91 asked for; it is asserted per-series against the card, never series-against-series (see Colors for why that second form is unachievable).
7. Every chart segment label reaches 4.5:1 on its own series colour, with the ink named in Components › Charts. This is what sets the floor under the darkest series in each theme.

Gold text on the navy band is allowed, because the band is not a light surface.

## Typography

There is one family: **Archivo Variable**, latin subset, weight axis only. It is a single self-hosted 35 KB woff2, declared once in `app.css`. Stitch set everything in Archivo Narrow. That was rejected: the width axis costs 90 KB on a field phone with a bad signal, and there is **no second family and no monospace** (coordinates, CSV headers and script keys also use Archivo with tabular figures).

| Role | Token | Use |
|---|---|---|
| Display | `{typography.display}` | KPI figures, import tallies ("124 lignes à importer"), the next stop's distance on tablet |
| Title | `{typography.title}` | Screen titles, e.g. "Tableau de bord", "Tournée du jour", the prospect name on a visit |
| Heading | `{typography.heading}` | Card and panel titles, the next stop's name on a phone |
| Body (field) | `{typography.body-field}` | All field text and **every input on both sides**, so iOS never zooms |
| Body | `{typography.body}` | Admin body text and table cells (the admin default) |
| Label | `{typography.label}` | Buttons, nav items, form labels |
| Meta | `{typography.meta}` | Timestamps, secondary lines, badges, tab labels |
| Overline | `{typography.overline}` | KPI labels, table column headers, sidebar group labels, rendered uppercase with CSS. The string in `copy.ts` stays in sentence case. The caps follow Stitch. |

**Numbers use tabular figures (`.tnum`), always**: counts, dates, times, distances, percentages and coordinates. In tables, quantities are right-aligned. Time columns are left-aligned, because they are read down as a sequence rather than compared. Figures are formatted for fr-FR: "1 284", "10,6 %", "24/09/2026 15:24", "350 m", "1,4 km".

## Layout & Spacing

→ See [`mockups/key-a1-dashboard.html`](mockups/key-a1-dashboard.html) for the admin grid at three widths and [`mockups/key-f1-tournee.html`](mockups/key-f1-tournee.html) for the field phone shell.

The spacing is Tailwind's 4-based scale plus the named tokens in the front matter.

**Admin shell.**
- A `{spacing.sidebar}` navy sidebar holds the navigation and is collapsible to `{spacing.sidebar-collapsed}` icons.
- A 56px white top bar holds the sidebar toggle, the breadcrumb, search, notifications, the theme toggle and the avatar.
- Content has a `{spacing.page-margin}` margin, and panels sit `{spacing.panel-gap}` apart. It spans the full width, with no max-width, because the admin is a table product.
- **Dashboard grid at ≥ lg:** 4 KPI cards in a row. Then "Visites dans le temps" and "Pipeline par statut" share a row 2:1. Then "Activité par agent" and "À traiter" share a row 1:1. Last, "Dernières visites" spans the full width.
- **md–lg:** the sidebar collapses to icons and the KPIs go 2×2.
- **< md:** the sidebar becomes a Sheet behind the menu button, and everything stacks in one column with a `{spacing.page-margin-compact}` margin.

**Field shell, phone (< md).**
- The navy band (`{spacing.band-height}`, plus safe-area-top) carries the mark, the wordmark and the sync dot.
- Under it sits the optional sync strip, then the scrolling content with a `{spacing.page-margin-compact}` margin.
- The bottom tab bar (`{spacing.tab-bar-height}`, plus safe-area-bottom) comes last.
- Sticky action buttons sit directly above the tab bar.

**Field shell, tablet (≥ md).** The tabs move into the navy band as a row after the wordmark, and there is no bottom bar. The content becomes two panes: on Tournée du jour, the list sits left (≈ 40 %) and the next stop right; on Carte, the list sits left and the map right. The visit becomes two columns: the form left, the prospect's history and map right.

**Targets.** Every field target is at least `{spacing.touch}`, and an outcome card is at least `{spacing.decision}`. An admin table row is `{spacing.row}`.

## Elevation & Depth

Depth comes from shadcn's defaults and nothing more. A card has a 1px `{colors.border}` hairline **plus** shadcn's faint `shadow-sm`. Popovers, menus and toasts use shadcn's `shadow-md`. The bottom sheet and dialogs sit over a navy scrim at 40 % opacity.

Stitch's "zéro ligne" rule (separating areas by shadow and shade alone) was rejected, because borders survive dark mode and low-grade tablet screens where shades blur together. No coloured edges on KPI cards: a coloured edge means a status, so it appears only on rows and cards that have one.

## Shapes

The radius is `{rounded.DEFAULT}` (6px) for buttons, inputs and selects, and `{rounded.xl}` (12px) for cards, dialogs and the sheet's top corners. Badges use `{rounded.sm}`. Dots, avatars, stop numbers and the current-tab pill use `{rounded.full}`. Stitch's 8px/16px and its drawn 2–8px were both rejected, so the app keeps today's `--radius`.

## Components

Components not listed here are shadcn defaults, restyled only through tokens: Button, Input, Select, Checkbox, Dialog, Sheet, DropdownMenu, Popover, Tabs, Table, Skeleton, Sonner, Alert, Progress, Sidebar, Breadcrumb, Command and Chart. Icons are **Lucide** (`lucide-react`), 16px in admin text and 20–24px on field targets, stroke 2. Stitch's Material Symbols are not used.

### Shared

- **Buttons.** Primary is `{components.button-primary}`: one per view as its main action. Secondary is used for other actions and for repeated row actions, such as "Garder" on Doublons or the candidate buttons on À rattacher. Destructive is used only for delete confirmations. On the field side, buttons are `{spacing.touch}` tall and the sticky action buttons span the full width.
- **Badges.** `{components.status-badge}` and `{components.outcome-badge}` are small tinted rectangles with the French label. "Flyer remis" is a secondary badge with a check icon.
- **Tables** (`{components.ledger-row}`). Rows are 44px. Status appears as the 4px edge **and** a `{components.status-badge}` in its own column. Headers use the overline style on a `{colors.secondary}` header row. Numbers are right-aligned. An empty cell shows "—". A selected row has a `{colors.secondary}` wash. The row menu is a ghost icon button (`MoreVertical`).
- **Charts** (shadcn Chart, which is Recharts in the admin chunk). "Visites dans le temps" is a stacked bar per day, one outcome colour per series, with the legend above the plot. Because the series are not 3:1 against each other, two cues carry the separation: every segment takes a **1px `{colors.card}` stroke** on the edge it shares with its neighbour, and a segment **≥ 22px tall prints its count** in the centre. The ink is fixed per theme, not per series: in light, navy `{colors.foreground}` on `{colors.outcome-no-contact}` (4.56:1) and `{colors.card}` on the other four (4.68:1 at worst); in dark, `{colors.primary-foreground-dark}` on **all five** (4.72:1 at worst, on `{colors.outcome-no-contact-dark}`). Never `{colors.foreground-dark}` on a dark series — on `{colors.outcome-interested-dark}` it is 1.59:1. Shorter segments stay unlabelled and are read from the tooltip. See [`mockups/key-a1-outcome-chart.html`](mockups/key-a1-outcome-chart.html). The stack order is fixed, Personne sur place at the bottom through Converti at the top, so a reader learns the order once. "Pipeline par statut" is a list of horizontal bars, one per status: label, count and share on one line, and a 6px bar in the status colour below. Gridlines are `{colors.border}`, axis text is meta in `{colors.muted-foreground}`, and there are no chart borders or backgrounds.
- **Empty states.** A 64px icon tile, then a title, one sentence, and one button. Nothing decorative.
- **Skeletons.** shadcn Skeleton blocks shaped like the content they stand in for: KPI cards, table rows, a chart area.
- **Toasts and banners.** Sonner toasts at bottom right, shadcn default, with the icon in the matching status colour (admin only). The update banner is a full-width Alert on `{colors.card}` with "Plus tard" (secondary) and "Mettre à jour" (primary). The admin **offline banner** takes that same slot and shape on `{colors.secondary}`, with a `WifiOff` icon and no button, matching the field strip's offline strip. EXPERIENCE.md § State Patterns says when each appears.

### Admin

- **Session-expired dialog.** shadcn Dialog on the navy scrim, with a `{colors.destructive}` `ShieldAlert` icon, no close button in the corner, and "Se reconnecter" as its single primary button, full width (behaviour in EXPERIENCE.md § State Patterns).

- **Sidebar** (`{components.sidebar}`). Groups are **Pilotage**, **Prospects** and **Terrain**, labelled in the overline style. An item is a 36px row with an icon and a label. The current item is `{components.nav-item-active}`. Count badges (Doublons, À rattacher) are small `{colors.warn}` pills with white numerals (4.9:1). The footer holds the signed-in email and a sync dot with its line ("Synchronisé à l'instant").
- **Top bar** (`{components.top-bar}`). From left to right: the sidebar toggle (`PanelLeft`), the breadcrumb ("Captain Prospectus › {group} › {page}"), a flexible gap, then the search button, the notifications bell with an unread dot in `{colors.primary}`, the theme toggle (`Sun`/`Moon`) and the avatar (initials on `{colors.primary}`).
- **KPI card** (`{components.kpi-card}`). From top to bottom: the label (overline) with a 32px icon tile at top right, the figure (display), then the delta chip followed by "vs période précédente" in meta, then a 32px-tall sparkline or mini-bar across the bottom. Prospects ouverts shows a thin stacked bar of Nouveau, Assigné and À relancer instead of a delta. Taux de conversion shows a thin gold progress bar, under the same exception as daily progress. There is no coloured edge.
- **Visites KPI strip.** Four compact KPI cards in one row, with no icon tile and no sparkline: an overline label, a display figure, and a meta context line ("sur 47 visites").
- **À traiter row.** A 40px `{colors.secondary}` icon tile, the title in label weight with a meta sub-line, the count right-aligned in heading weight with tabular figures, then a secondary button. Rows are separated by `{colors.border}` hairlines.
- **Stepper (import).** Numbered circles joined by a line. A done step shows navy with a check, the current step gold with navy text, and a future step secondary. The step label sits beside or below the circle.
- **Script question card.** A card with a `GripVertical` drag handle and the number in label weight. A row holds the label input and the type select. A footer on `{colors.secondary}` holds the "Obligatoire" checkbox, a `Lock` icon with the key (Archivo, not monospace) and a ghost "Modifier la clé". The locked-key warning is a meta line with an `Info` icon.
- **Admin round view.** Inside the admin shell: an agent Select with the position age beside it in meta, then two panes, the stop list left and the map right. Stops and pins look the same as on the field Carte.

### Field

- **Field band** (`{components.field-band}`). The mark, "Captain Prospectus" in heading weight, a meta subtitle naming the current tab, and on the right the sync dot with its pending count and the avatar. The sync dot is `{colors.success}` when synced, `{colors.warn}` with a count when items are waiting, pulsing `{colors.band-muted}` while syncing, and `{colors.destructive}` when the session has expired.
- **Sync strip** (`{components.sync-strip}`). A full-width strip under the band.

  | State | Look |
  |---|---|
  | Waiting to send, syncing | Band colour, one step darker |
  | Offline, failed | `{colors.secondary}` |
  | Session expired | `{colors.destructive}`, text in `{colors.on-destructive}`, with a right-aligned button outlined in the text colour |
  | Update needed | `{colors.warn}`, text in `{colors.on-destructive}` (white in light, ink in dark, ≥ 4.5:1 in both), with the same outlined button |

  Only "Session expirée" and "Mise à jour" carry a button.
- **Tab bar** (`{components.tab-bar}`). Four slots at most: Tournée (`Route`), Carte (`Map`), Ajouter (`MapPinPlus`), and Tableau de bord (`LayoutGrid`, admins only). Each has a 24px icon over a meta label. The current tab gets a gold pill behind its icon (`{components.tab-active}`) and a navy label. Ajouter is a normal tab. Stitch's raised gold Ajouter button is not carried over, because it would read as the main action on every screen.
- **Next-stop card** (`{components.next-stop-card}`). A card with a 4px gold left edge. It holds the `{components.stop-number}` in gold, the name (heading), "type · address" in meta, and the distance right-aligned in label weight. Under that, two equal buttons: "Y aller" (secondary, `Navigation` icon) and "Visiter" (primary, `ClipboardCheck` icon).
- **Stop row.** The number in a secondary disc, the name in label weight, "type · address" in meta, and the distance right-aligned. A 4px edge in the prospect's status colour. A "Pas encore envoyé" warn badge when a visit to this stop is still waiting to send. Mid-swipe, the row slides to reveal a `{colors.primary}` panel with a check and "Visiter", or a `{colors.secondary}` panel with "Y aller".
- **Daily progress.** A shadcn Progress bar with an 8px `{colors.secondary}` track and a `{colors.primary}` fill, the count line above it. Gold is a deliberate exception, shared with the Taux de conversion bar: these are the progress figures people steer by.
- **Step indicator (visit).** An overline in `{colors.muted-foreground}`, led by a 6px `{colors.primary}` dot: "Étape 1 sur 2 · Résultat".
- **Outcome card** (`{components.outcome-card}`, `{components.outcome-card-selected}`). A full-width card with a neutral icon tile, the outcome label in heading weight, a one-line hint in meta, and a radio disc on the right. Icons are the same neutral colour for all five: `DoorClosed`, `ThumbsUp`, `ThumbsDown`, `Clock`, `BadgeCheck`. When selected, the card turns gold as specified. No outcome shows a status colour.
- **Choice controls (field).** Yes/no pairs, single-choice rows, type chips (2 columns) and the 1–5 rating (5 equal tiles) are unselected on `{colors.card}` with a border, and `{components.choice-selected}` when chosen. The number stepper shows the value in display weight between two 48px secondary buttons (− and +).
- **Bottom sheet / dialog (save confirmation).** A drag handle, an overline "Validation", the title, then a summary table on `{colors.secondary}` (name, outcome badge, "Flyer remis", number of answers, notes in italic), then the reassurance line with a `CloudUpload` icon, then the primary "Enregistrer" above the secondary "Modifier". On tablet the same content appears in a centred Dialog with the buttons side by side.
- **Map** (Leaflet; OpenStreetMap tiles only when online). The next stop's pin is `{components.map-pin-next}` and the other pins `{components.map-pin}`, with numbers in walking order. The agent's position is `{components.map-position}`. The walking path is a 3px dashed `{colors.primary}` line. Controls are shadcn icon buttons in white 44px squares at bottom right. The attribution "© les contributeurs OpenStreetMap" is Leaflet's own control, in meta.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use gold for the main action and for what is selected, always as a fill with navy text and the edge | Use gold as text on a light surface, as the focus ring, or with white text |
| Show Converti in green everywhere | Use gold, or any tint of it, for Converti |
| Pair every colour signal with a French label (status, outcome, delta, sync) | Let colour carry meaning alone |
| Separate stacked chart segments with a 1px card stroke and an in-segment count | Rely on series-vs-series contrast to tell two outcomes apart |
| Use Archivo Variable only, with tabular figures for every number | Use Archivo Narrow, a monospace or a second family |
| Separate areas with a 1px border plus a faint shadow | Use shadow-only "zéro ligne" layering, or coloured edges on cards that have no status |
| Show outcomes in neutral colours on the field visit form | Preview on the phone the status an outcome will lead to |
| Use Lucide icons | Use Material Symbols or an icon font |
| Stick to one gold action button per view; repeated row actions are secondary | Put a gold button on every row (Stitch's Doublons) |
| Use the fr-FR number and date formats shown above | Leave spec text on screen ("48px targets", ADR numbers, registry codes) |

## Sources and mockups

The Stitch exports in `stitch/admin/` and `stitch/terrain/` are composition references. **The spines win on conflict.** They are light mode only, and they carry the errors listed in the memlog. The key-screen mocks are rendered from this file and replace the missing Stitch coverage:

- [`mockups/key-a1-dashboard.html`](mockups/key-a1-dashboard.html): the admin shell and Tableau de bord in light and dark at 1280px, the tablet layout (icon sidebar, KPIs 2×2) and the phone layout (drawer, one column). Also the outcome colours in both themes.
- [`mockups/key-f1-tournee.html`](mockups/key-f1-tournee.html): the field shell on a phone in light and dark. Shows the band, sync strip, daily progress, next-stop card, stop rows with a swipe reveal, Plus tard, and the tab bar with its gold current-tab pill.
- [`mockups/key-f3-f5-visit.html`](mockups/key-f3-f5-visit.html): the visit in dark. Shows gold as selection on the outcome cards, neutral outcome icons, the step indicator, and the save sheet.
- [`mockups/key-f2-carte.html`](mockups/key-f2-carte.html): Carte online in light and offline in dark. Shows the pins, position dot, walking path, the re-centre button, the sheet above the tab bar, and the offline notice with no cached tiles.
- [`mockups/key-f8-sync.html`](mockups/key-f8-sync.html): the band dot and sync strip in all 7 states, light and dark.
- [`mockups/key-admin-round.html`](mockups/key-admin-round.html): the admin round view in light and dark, plus the no-position state.
- [`mockups/key-a1-outcome-chart.html`](mockups/key-a1-outcome-chart.html): "Visites dans le temps" in light and dark with the revised outcome colours, the 1px separator and the in-segment counts, over a table of each series' measured ratio against the card (issue #91).

The mocks load Archivo and the mark from the repo by relative path, so open them from inside the checkout.
