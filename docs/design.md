# Design

The visual system. [ADR-0014](adr/0014-tailwind-and-shadcn-ui.md) decided *how*
we build the interface (Tailwind v4, shadcn/ui vendored into `src/client/ui/`);
this file records *what it looks like* and why, so a screen built in M3 matches
one built in M1.

Tokens live in the `@theme` block of `src/client/styles/app.css`. That file is
the implementation; this one is the reasoning. If they disagree, the CSS is
right and this file needs updating. Tailwind builds it from `src/client` only:
a class name in a mockup, a doc or `index.html` gets no utility (GH #529).

## Grounding

The artifact this app replaces is a **carnet de tournée** — a route notebook: a
list of addresses, ticks, and scribbled outcomes. The mark is a ship's wheel
around a map pin: a captain plotting a round. Navy and gold come from it, and
they suit the app — navy is the ink, gold is where you are heading.

The app has **two faces with one palette and one typeface**:

- **The admin side is a dashboard**, a quiet version of the shadcn SaaS
  dashboard: a navy sidebar holds the navigation, and the figures that say how
  canvassing is going (KPI cards, charts) come before the tables and queues
  under them. It is built for a laptop and still works on a tablet or a phone.
- **The field side is the page torn out of that notebook.** An agent on a
  Brussels pavement, phone in one hand and flyers in the other, sun on the
  screen, often no signal. It keeps the admin's tokens under a navy band, with
  bigger type, bigger targets and one decision per screen.

The system is shadcn/ui ([ADR-0014](adr/0014-tailwind-and-shadcn-ui.md)); this
file specifies only the brand layer on top of shadcn's defaults: the colours,
one typeface, a slightly tighter radius, and the app's own components.

Layout and every section after it still describe today's shell and screens;
each is rewritten as it adopts this system.

## Colour

The brand: **navy `#1b2a4a`** and **gold `#c9a227`**, taken from the mark, and
the off-white `#f6f7f0` it sits on. Navy is the ink and the band. Gold has two
jobs and no others: it marks **the main action** on a view (Visiter,
Enregistrer, Importer…) and **what is selected** (the current sidebar item and
tab, the chosen outcome card or answer, the next stop). Gold is always a fill,
with navy on top and a `primary-edge` border.
One decorative exception: the 4px top edge of the login card
([The login page](#the-login-page)) — the first screen anyone sees carries the
brand's gold once more. Nowhere else.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F6F7F0` | `#101726` | The page |
| `card` | `#FFFFFF` | `#182031` | Cards, tables, sheets, dialogs |
| `foreground` | `#1B2A4A` | `#E7EAF0` | The ink: text and icons |
| `secondary` (also `muted`, `accent`) | `#E8EAEF` | `#222B3D` | Secondary buttons, icon tiles, skeletons, unselected choices |
| `muted-foreground` | `#5A6478` | `#97A2B8` | Meta text, help text, column headers |
| `border` (also `input`) | `#D7DAE2` | `#2B3547` | Hairlines |
| `primary` (gold) | `#C9A227` | `#D9B43C` | The main action and what is selected, as a fill |
| `primary-foreground` | `#1B2A4A` | `#141C2E` | Text on gold |
| `primary-edge` | `#A8801A` | `#E6C65C` | The border of every gold fill |
| `ring` | `#1B2A4A` | `#E7EAF0` | The focus ring |
| `success` | `#1F6F4A` | `#4FA97D` | `converted`, an upward delta |
| `warn` | `#9A5B18` | `#D98A3C` | `follow_up`, waiting to send, count pills |
| `destructive` | `#8C2F39` | `#D2757E` | `rejected`, a downward delta, delete |
| `on-destructive` (utility `destructive-foreground`) | `#FFFFFF` | `#141C2E` | Text on a `destructive` or `warn` fill |
| `band` | `#1B2A4A` | `#0B1120` | The admin sidebar and the field band |
| `band-foreground` | `#EEF0F4` | `#E7EAF0` | Text on the band |
| `band-muted` | `#95A0B8` | `#7D899F` | Quieter text on the band, sidebar group labels |
| `band-accent` | `#FFFFFF14` | `#FFFFFF0F` | Hover wash on the band (white at 8 % / 6 %) |
| `band-border` | `#FFFFFF1F` | `#FFFFFF14` | Hairlines on the band (white at 12 % / 8 %) |
| `band-strip` | `#142038` | `#070B15` | The sync strip: the band, one step darker |
| `overlay` | `#00000080` | `#00000080` | The scrim behind a dialog, alert dialog or sheet (black at 50 %) |
| `status-new` | 16 % ink | 16 % ink | The `new` row edge |
| `status-assigned` | 55 % ink | 55 % ink | The `assigned` row edge |
| `outcome-no-contact` | `#8A92A4` | `#7C87A0` | `no_contact` in charts |
| `outcome-interested` | `#2E3F63` | `#AEBBDB` | `interested` in charts and badges |
| `outcome-not-interested` | `#5B5F63` | `#8E9399` | `not_interested` in charts |

The outcome colours are admin-only: the stacked visits chart and the outcome
badges. `follow_up` and `converted` outcomes reuse `warn` and `success`. The
field visit form never shows them; its outcome cards stay neutral until one is
chosen, so the phone never previews the status an outcome leads to.

Deltas are `success` when up and `destructive` when down, always with an arrow
and a signed figure. No colour carries a meaning alone: a status, outcome,
delta or sync state always has its French label too.

`warn` moved from `#9A6B12` to `#9A5B18` because the old mustard gave 4.0:1 on
its own 12 % badge tint, failing rule 5. The new one is 5.4:1 on white, 4.6:1 on
its tint, and 15° in hue clear of the gold.

### Badges

A status or outcome badge is a small tinted rectangle (`rounded-sm`, meta type)
with the French label. The fill is the badge's colour mixed **at most 12 %**
into the card, as a `tint-*` token (`color-mix(in oklab, <colour> N%,
var(--card))`).

| Badge | Text | Fill |
|---|---|---|
| Nouveau (`new`) | `muted-foreground` | `secondary` |
| Assigné (`assigned`) | `foreground` | `tint-assigned`: 7 % ink, i.e. 12 % of the 55 % edge, kept opaque |
| À relancer (`follow_up`) | `warn` | `tint-warn` |
| Intéressé (`interested`, status) | `success` | `tint-interested`: 7 % success, i.e. 12 % of the 55 % edge, kept opaque |
| Converti (`converted`) | `success` | `tint-success` |
| Refusé (`rejected`) | `destructive` | `tint-destructive`: 12 % light, 10 % dark |
| Personne sur place (`no_contact`) | `muted-foreground` | `secondary` |
| Intéressé (`interested`, outcome) | `outcome-interested` | `tint-outcome-interested` |
| Pas intéressé (`not_interested`) | `foreground` | `tint-outcome-not-interested` |

`converted` has its own `success` token and is **always green**. A gold
`converted` would sit 7° in hue from the mustard that means `follow_up`, and
the two would stop being separable. Intéressé (`interested`) uses the same
green at partial strength — a 55 % edge and a regular-weight label — so it
never reads as a win, and the label always tells the two apart.

### The six rules

Each is forced by a measurement rather than taste.
`src/client/styles/palette.test.ts` asserts the tokens behind each rule in
light, in dark pinned with `data-theme`, and in dark from the system: nudging a
hex so that one breaks fails CI and names the theme. A second tier scans every
class string in `src/client` (excluding tests) for rule 4 (a `bg-primary` fill
with no `primary-edge` boundary under the same variant-prefix chain, or one
that applies whenever it does — `dark:` stacked on top of an already-guarded
state, say) and for rule 2's destructive pairing (`text-white`, or a dimmed
`bg-destructive/NN` fill under any prefix chain except a transient `hover:`
one, which makes the asserted ink-on-`destructive` pair vacuous) — GH #67,
after both slipped past the token tier once each (#69, #70). Rule 1 stays a
usage rule, kept in review: nothing scans arbitrary component markup for gold
text on a light surface.

1. **Gold is never text on a light surface.** It is 2.4:1 on white. This keeps
   every word legible: gold only ever says "act here" or "chosen" as a fill.
2. **Text on gold is navy, never white.** Navy gives 5.9:1; white gives 2.4:1.
   This keeps the main action's label readable in the sun.
3. **Gold is never the focus ring; `ring` is the ink.** A ring needs 3:1
   against what it sits on and gold gives 2.4:1, so a gold ring would vanish
   exactly where keyboard users need it. This is the one place shadcn's default
   wiring (`ring` follows `primary`) is broken.
4. **Every gold fill carries `primary-edge`.** The fill is 2.2:1 against the
   page, below the 3:1 WCAG 1.4.11 wants for a control's boundary; the darker
   gold edge gives 3.4:1 and still reads as gold. `progress.tsx`'s indicator
   bar carries it too (an inset shadow, since the track's `overflow-hidden`
   already clips it to the rounded shape).
5. **Status and outcome badge text reaches 4.5:1 on its tint.** This keeps a
   badge's word legible, not just its colour. A tint that fails drops below 12 %
   in that theme until it passes, which is why dark `tint-destructive` is 10 %.
6. **Every outcome colour clears 3:1 on its theme's card.** A chart series is a
   graphical object (WCAG 1.4.11), so each of the five, `warn` and `success`
   included, must stand out from the card it is drawn on. Series are not 3:1
   against each other and never will be: five mutually distinct colours would
   need an 81:1 luminance range, and sRGB has 21:1 (#91). The stacked chart
   separates neighbours structurally instead.

Gold text on the navy band is allowed, because the band is not a light surface.

Dark follows the system by default and can be pinned with `data-theme` on
`<html>`. Tokens swap their *values*, so components rarely need a `dark:`
utility; the variant exists for the few that do. The two dark blocks in
`app.css` must stay identical, which the test also checks. The admin top
bar's Sun/Moon toggle (GH #64) is what pins it: a click stores the chosen
theme in `localStorage` and writes it straight to `data-theme`, with no route
back to "system"; a classic `<script>` in `index.html` applies a stored pin
before first paint, so a pinned-dark reload never flashes light. The field
side reads the same pin through that boot script, and its account card
(GH #561, "Account card" below) is where an agent sets it: Système, Clair or
Sombre, the same one setting per phone. Système is the absence of a pin, so
choosing it clears the stored theme and `data-theme`; the admin toggle keeps
its two states.

## Status is read down the left edge

The admin's real question is "which of these has nobody been to?". So each
ledger row carries a 4px leading edge keyed to its status, painted as an inset
shadow on the first cell. Scanning the edge answers that question without
reading a word.

| Status | Edge token | Label colour |
|---|---|---|
| `new` | `status-new` — 16% ink | `muted-foreground` |
| `assigned` | `status-assigned` — 55% ink | `foreground` |
| `follow_up` | `status-follow-up` — `warn` | `warn` |
| `interested` | `status-interested` — 55% `success` | `success`, regular weight |
| `converted` | `status-converted` — `success` | `success` |
| `rejected` | `status-rejected` — `destructive` | `destructive` |

Two rules this encodes, both deliberate:

- **Colour never carries the information alone.** The French label from
  `STATUS_LABELS` is always in its column too.
- **`assigned` must not outshout `converted`.** It is a mid-neutral, not full
  ink. The first version used full ink and `assigned` became the loudest thing
  in the column, which put "someone owes a visit" above "we won this one".

## Type

One family: **Archivo Variable**, latin subset, **weight axis only** — a single
35 KB woff2, self-hosted, declared as one `@font-face` in `app.css`. There is
no second family and no monospace: coordinates, CSV headers and script keys are
Archivo with tabular figures too.

The width axis was considered and cut: it is 90 KB for the same glyphs, and the
field PWA pays that on a phone with bad signal (vision.md) to buy a subtle width
shift on about three strings. Display type takes its character from weight and
tracking instead.

Importing the fontsource stylesheet would emit every subset, and Workbox's
`globPatterns` precaches every `woff2` it finds — hence the hand-written
`@font-face` naming one file. Latin alone covers French, including œ (U+0153).

Each role is a `--text-*` token carrying its size, line height, tracking and
weight, so one utility sets all four; an explicit `font-*` utility still wins.

| Role | Token | Size / weight | Use |
|---|---|---|---|
| Display | `text-display` | 28px / 700 | KPI figures, import tallies |
| Brand | `text-brand` | 22px / 700, -0.015em | The app's name above the login card, and nowhere else |
| Title | `text-title` | 20px / 600 | Screen titles, the prospect name on a visit |
| Heading | `text-heading` | 16px / 600 | Card and panel titles, the next stop's name on a phone |
| Body (field) | `text-body-field` | 16px / 400 | All field text and **every input on both sides**, so iOS never zooms |
| Body | `text-body` | 14px / 400 | Admin body text and table cells (the admin default) |
| Label | `text-label` | 14px / 500 | Buttons, nav items, form labels |
| Meta | `text-meta` | 12px / 500 | Timestamps, secondary lines, badges, tab labels |
| Overline | `text-overline` | 12px / 500, 0.06em | KPI labels, column headers, sidebar group labels |

The overline is rendered uppercase by the component (`uppercase`); its string
in `copy.ts` stays in sentence case. The token is `text-overline` because
Tailwind's bare `overline` utility is a text decoration.

**Numbers use tabular figures (`.tnum`), always**: counts, dates, times,
distances, percentages and coordinates. In tables, quantities are
right-aligned; time columns are left-aligned, because they are read down as a
sequence rather than compared. Figures are formatted for fr-FR: "1 284",
"10,6 %", "24/09/2026 15:24", "350 m", "1,4 km".

## Layout

The admin side has a navy sidebar (GH #63): **Pilotage** (Tableau de bord,
Utilisateurs), **Prospects** (Prospects, Import, Doublons) and **Terrain**
(Visites, À rattacher, Scripts), each item a 36px row
with an icon and a label, group labels in the overline style. The current item
is a gold fill with navy text and a `primary-edge` inset; item text otherwise
stays `band-foreground` in every state, including the `band-accent` hover
wash — `band-muted` is for group labels only, which never take the wash.
Tableau de bord lives at `/admin` itself, so it matches exactly (`end`): it is
current on `/admin` and never on a path under it. An `/admin/*` path no route
knows shows "Page introuvable." inside the admin frame. The
width follows the viewport: full (`16rem`) at ≥ 1024px, an icon rail (`3rem`)
from 768 to 1023px with a Tooltip naming each item, and a Sheet drawer below
768px behind a menu button in the top bar. Doublons and À rattacher carry a
`warn` pill badge — a dot on the icon in the rail — shown only when their
count is above zero and their query has not failed; the count always equals
what their own screen lists, because both read the same query. The two sides
share the band's look and tokens, but each owns its frame: the admin frame
(sidebar and top bar) ships in the admin chunk, and the field band carries the
sync state.

The sidebar ends with the **recap card** in its footer, on every admin page: the
day's story in small type, before the admin opens a screen. An admin has no sync
of their own, so it never says "synchronisé"; it reports what the agents sent
(forge `admin-sync-status-meaning`). The Brussels day heads it in the overline
style ("MARDI 14 OCTOBRE"), then three `text-xs` lines on `band-accent`: a dot
and "1 / 2 agents actifs", "12 visites", and in `band-muted` "Dernière visite
reçue il y a 4 min". Actif means an agent on the roster who started that day's tournée
([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)), the swipe alone
counting, so the figure never passes the roster; the visits are the day's
door-days (one per agent, prospect and visit made that Brussels day, the
dashboard's Visites for one day, [ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md));
the agents and the last visit read `received_at`, the server's clock. The dot is
`success` while anyone is active and `band-muted` otherwise. It is not a verdict:
there are no working hours, so no amber. With nothing yet, the lines read
"0 / 2 agents actifs" and "Aucune visite". The card is capped at the date and
those three lines, carries no email, avatar, menu or link, and is absent while
its query loads or has failed. In the rail it shrinks to an `Info` icon tile
whose Tooltip and accessible name carry the same four lines; the drawer shows it
in full. See [`api.md`](api.md) for `GET /api/admin/recap`.

The top bar (GH #64) sits beside the sidebar toggle, left to right: the
breadcrumb, a flexible gap, search, the notifications bell, the theme toggle
and the avatar menu. The breadcrumb reads "Captain Prospectus › {group} ›
{page}" at ≥ 1024px, "{group} › {page}" from 768 to 1023px, and just "{page}"
in semibold below 768px — `NAV_GROUPS` and `isCurrent` supply the group and
page, so it can never name one the sidebar disagrees with; a path outside
every group (a route this epic has not shipped a sidebar entry for) falls back
to the app name alone. Search is a 240px outlined button from 768px
("Rechercher un prospect…", with a shortcut hint) and an icon button below
that; the button and ⌘K/Ctrl+K open a shadcn `CommandDialog` whose only
content is its input and an explanatory empty state — there is no back end
yet, and no request is made. The bell is a disabled icon button with no
content. The avatar is initials on `primary` with a `primary-edge` ring,
opening a `DropdownMenu` with the signed-in email and "Se déconnecter", a menu
item that ends the session with `POST /api/auth/logout` and then opens `/login` —
see [identity-access.md](domains/identity-access.md). The field avatar opens the
account card ("Account card" below).

The **Hors ligne screen** (ADR-0037, R6) is what a cached admin identity sees on
`/admin/*`: the brand-only band (no tabs, no avatar), the empty-state shape (64px
`secondary` tile with `WifiOff`, title, muted sentence) and one primary touch-size
« Réessayer » button. While the re-check runs the button is disabled, `aria-busy`
and shows the `Spinner` before « Vérification… »; a failed re-check returns to the
same screen with no toast, and a line under the sentence says it is still offline
(`role="status"`). When the browser reports a network but `/api/me` failed, the
title and sentence read « Le serveur ne répond pas » instead (admin screen only). The same screen is
the recovery state of a failed admin chunk load. It ships in the entry chunk.

`AdminLayout`'s banner slot, between the top bar and `<main>`, holds one of
two mutually exclusive things (GH #209): the update prompt when a build
waits, or — while `useOnline()` reports offline — a full-width `Alert`
reading "Hors ligne. Les données affichées ne changent plus et se
rafraîchiront au retour du réseau.", gone as soon as the browser reports back
online. Offline wins the slot, since a build cannot be fetched offline. Each
screen's own load-failed Alert (`ScreenState`, `DashboardScreen`) stands down
for the same reason while offline, and panels keep whatever data they last
held rather than each repeating the banner's sentence. The banner sits in an
always-mounted `aria-live="polite"` region, so it is announced when it appears,
and when it goes the region reads out a hidden "Connexion rétablie."

Safe-area insets go on `.safe-top` (the band) and `.safe-bottom` (the field's
bottommost fixed element — the tab bar below 768px, GH #66), never on `body`,
so the band stays flush with the top of a notched phone and the tab bar stays
flush with the bottom. Both live in `app.css`'s `@layer utilities`, not
`@layer base`: Tailwind v4 orders `utilities` after `base`, so a plain `py-*`
there always wins over the inset (GH #80). A `<main>` that needs both its own
bottom margin and the inset — everywhere a screen is not directly above the
tab bar — uses `.pb-page` instead of stacking `.safe-bottom` and `pb-6` on one
element, which cannot own `padding-bottom` twice.

### Tableau de bord

`/admin` opens here (GH #107). It says how canvassing is going over the last 7,
30 or 90 days; every figure is defined once, in [api.md › The
dashboard](api.md#the-dashboard), and the Worker computes it.

- **Header.** The title (`text-title`) and "Où en est la prospection." on the
  left; on the right the period selector, a shadcn `ToggleGroup` of "7 jours",
  "30 jours", "90 jours" on a `secondary` track, the chosen one lifted onto
  `card` with a shadow — a segmented control, not a gold fill. 30 is the
  default, and pressing the chosen period again keeps it. It is the only
  selector on the screen. It wraps under the title on a phone.
- **KPI card.** A shadcn `Card` with no coloured edge — on this app an edge
  means a status. Top to bottom: the label in `text-overline` with a 32px
  `secondary` icon tile at the top right (Lucide `Building` for Prospects
  ouverts, `MapPin` for Visites, `BadgeCheck` for Convertis, `Percent` for
  Taux de conversion), the figure in `text-display` with tabular figures,
  then the delta chip and "vs période précédente" in meta. The chip
  is a `rounded-sm` Badge: `tint-success` with an up arrow when the rounded
  delta is up, `tint-destructive` with a down arrow when it is down, and
  neutral `secondary` with no arrow for "0,0 %" and for "—" (no previous
  period). The figure is signed, with a real minus: "+12,4 %", "−3,0 %".
  Prospects ouverts is a snapshot, so it has no delta row; an empty row of
  the same height keeps its figure level with its neighbours'.
  Three cards are one link each to the list behind the figure (GH #114),
  named "{label} : {figure}. Voir la liste", with the `ring` focus ring and a
  faint `accent` wash on hover: Prospects ouverts to Prospects filtered
  `status=new,assigned,follow_up`, whose total is the figure; Visites to
  Visites on the same period (`?period=`, GH #178), whose count is by
  `received_at` and capped at 500, so it may differ from the figure; Convertis
  to Prospects `status=converted`, every prospect converted now rather than
  those converted in the period, so the two counts may differ. Taux de
  conversion has no list and is not a link.
  Taux de conversion's figure is a percentage with one decimal, "10,6 %", or
  "—" when nothing was visited; its chip is in points, "+1,2 pt", "−0,4 pt",
  toned by the same rounding.
  Across the bottom, 10px under the delta row, is a 32px row (GH #111):
  - **Visites and Convertis** get a sparkline with one point per day
    of the period (`byDay`, [api.md](api.md#the-dashboard)). It is a 2px line
    scaled to the period's own min and max, so its shape fills the row as in
    the mockup, and a flat series sits at mid-height. The bars keep a zero
    baseline. It has no axis, dot, tooltip or animation, and its colour is the
    chip's tone: `success` up, `destructive` down, `muted-foreground` flat or
    "—". A green line never sits under a red chip. It is decorative
    (`aria-hidden`), since the figure says the value.
  - **Prospects ouverts** gets a 6px stacked bar of Nouveau (`status-new`),
    Assigné (`status-assigned`) and À relancer (`warn`), with 2px card-coloured
    gaps. "Nouveau · Assigné · À relancer" sits under it in meta, and a
    visually hidden sentence reads out the counts. With nothing open, only the
    `secondary` track shows.
  - **Taux de conversion** gets a 6px Progress, gold on a `secondary` track,
    under the same exception as the field's daily progress. The rate is capped
    at 100 %. Under it is "{n} convertis sur {m} prospects visités" (singular
    for 0 and 1), or "Aucun prospect visité sur la période" when the rate is
    "—".
- **Grid.** Cards are 4 across at ≥ lg, 2 × 2 at md and one column below,
  24px apart, in this order: Prospects ouverts, Visites, Convertis, Taux de
  conversion. The panels below follow in rows of the same 24px gap.
- **Visites dans le temps** (GH #110). Under the KPIs, 2:1 with the pipeline
  at ≥ lg, full width below. A
  `Card` titled in `text-heading` holds shadcn Chart (`src/client/ui/chart.tsx`,
  Recharts, admin chunk only): a stacked bar per Brussels day, Personne sur
  place at the bottom through Converti at the top, coloured `outcome-no-contact`,
  `outcome-interested`, `outcome-not-interested`, `warn`, `success`. Each
  segment under a drawn neighbour takes a 1px `card` line on its top edge. A
  segment ≥ 22px tall **and** wide enough for its digits (14px for one, ~7px
  more per digit) prints its count, centred, in
  `primary-foreground` on no-contact and `card` on the others in light,
  `primary-foreground` on all five in dark (palette.test.ts rule 7); so 90 days
  and the narrower 30-day bars read from the tooltip. The legend sits above the
  plot and never toggles a series. Hovering a day shows all five counts, zeros
  included, under "lundi 21 septembre". Ticks read "lun. 21" over 7 days and
  "21/09" beyond, thinned by Recharts. A visually hidden table ("Visites par
  jour et par résultat") gives each day's counts and total.
- **Pipeline par statut** (GH #112). The 2:1 row's third column, under the
  chart below lg. A `Card` titled in `text-heading` with "{n} prospects" in
  meta on the right. One row per status in `STATUSES` order, zeros included:
  the `STATUS_LABELS` label on the left; on the right the count in semibold
  tabular figures — `muted-foreground` for Nouveau, `foreground` for Assigné,
  `warn`, `success` (Intéressé and Converti), `destructive` for the others —
  and its share in meta, one decimal. Under each, a 6px `secondary` track with
  a fill of that share in `status-new`, `status-assigned`, `warn`,
  `status-interested`, `success` or `destructive`. The share is of the
  pipeline's own total; a total of 0 shows "0 prospect", 0,0 % and empty
  tracks. The bars are decorative, the text carries the figures.
- **Activité par agent** (GH #112). A row under that, 3:2 with À traiter at ≥ lg, as
  in the mockup, so the five columns fit at 1280 px; full width below.
  A `Card` holding shadcn `Table`: the head row on `secondary` in
  `text-overline` — Agent, Visites, Convertis, À relancer, Prospects ouverts —
  then one 44px row per agent. The
  agent cell is a 26px `secondary` circle with the email's uppercase initial,
  then the email; at ≥ lg the email takes the width the figures leave and
  truncates with an ellipsis, its full address in a `title`, so a long one
  never pushes the figures out. Numbers are right-aligned tabular figures; Convertis is
  `success` semibold and À relancer `warn` semibold. Rows are not links.
  The table scrolls sideways inside its card at 390 px. With no
  agent, the card says "Aucun agent pour l'instant."
- **À traiter** (GH #113). The 3:2 row's right part; under the table below
  lg. A `Card` titled in `text-heading` with four rows split by `border`
  lines: a 40px `secondary` icon tile (Lucide `Clock`, `Link`, `Copy`,
  `UserX`), the label with a meta line under it, the count in semibold
  tabular figures, and a small `secondary` Button. Relances dues, "À relancer
  aujourd'hui ou plus tôt", "Voir" to Prospects filtered
  `status=follow_up&dueBefore={to}` — the dashboard's own boundary, so the
  list totals the count; Visites à rattacher, "Conservées, pas encore
  comptées", "Rattacher" to À rattacher; Doublons, "Semblent désigner le même
  endroit", "{n} paires", "Fusionner" to Doublons; Prospects sans agent actif
  (ADR-0029), "Assignés à un agent désactivé", "Réassigner" to Prospects
  filtered to inactive agents, where the toolbar shows the filter as the chip
  "Agent : désactivé" (§ One toolbar slot) and the list totals the count.
  Like the other filters it lives in the URL, under the name the story that
  adds it gives in [api.md](api.md); the Agent select reads "Agent désactivé"
  while it is on, and the chip's × or another choice there clears it.
  Visites à rattacher and Doublons come from the sidebar's own queries, with
  no request of their own; Prospects sans agent actif comes with the
  dashboard's figures, a field that same story adds to [api.md › The
  dashboard](api.md#the-dashboard). Visites à rattacher
  counts the whole queue (the page plus `remaining`). At 0 the count turns
  `muted-foreground` and the button is disabled, not a link; so is a row whose
  query is loading or has failed, which shows "—" rather than a guessed 0.
- **Dernières visites** (GH #113). The last row, full width. A `Card` with
  "Tout voir ›" to Visites on the right of its title, then shadcn `Table`:
  Heure, Prospect, Résultat, Flyer, Agent, on a `secondary` head row in
  `text-overline`. The five newest door-days of the live feed (the same query,
  cache entry and 15 s poll as Visites), by `received_at`, each showing its
  latest visit
  ([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md) R13).
  Each row's leading 4px edge is the outcome's consequence, as on Visites
  (`STATUS_EDGE`); the outcome badge says the outcome itself: À relancer and
  Converti as their status badge, the other three in `foreground` ink on
  their tint (`secondary` for Personne sur place) with a 4px inner edge in
  their `outcome-*` colour, as in the mockup. "Flyer remis" is a `secondary`
  badge with a check, and "—" when none. A visit that arrives while the
  screen is open gets the `accent` wash until the next poll, then fades, and
  a visually hidden polite status says "1 nouvelle visite" once per poll,
  counting only rows shown. The opening page is not news: no wash, no
  announcement, even when an earlier visit to Visites left a page cached. A
  failed poll says "Impossible de charger les visites. Réessayez." under the
  rows it keeps. It scrolls sideways
  inside its card at 390 px. Empty: "Aucune visite reçue. Les visites
  apparaissent ici dès qu'un agent synchronise."
- **Loading.** Skeleton cards and panels of the same shape stand in until the first
  answer, with a visually hidden "Chargement du tableau de bord…". Switching
  period keeps the last period's cards on screen, dimmed, until the new
  figures land — never back to skeletons.
- **Failure.** An inline destructive Alert, "Impossible de charger le tableau
  de bord.", with a "Réessayer" button that refetches. With no figures yet it
  stands in place of the KPI cards and the panels above Dernières visites,
  which keeps its own feed; a failed refetch keeps the last figures under it.
- **Freshness.** Only Dernières visites polls (15 s); the figures do not,
  since a 15 s aggregate would spend the D1 read quota
  ([api.md](api.md#the-dashboard)). Every admin mutation marks the
  dashboard's query stale (`createAdminQueryClient`), so it refetches as soon
  as it is on screen, whatever `staleTime` a later story sets.

### One toolbar slot

Above a list there is exactly one slot. It holds the search box first, then the
filters; the moment anything is selected it is **replaced in place** by the
actions — same position, same height, no floating bar, no layout shift. Its
contents always answer "what can I do right now". Scoped to Prospects,
Doublons and the Visites filters; what the slot holds on Doublons, which has
no filters today, is settled in § Doublons.

```
│ 🔍 Rechercher…  Statut ▾   Agent ▾   Source ▾   412 prospects │   nothing selected
│ 12 sélectionnés   [Assigner à ▾]  [Désassigner]       Annuler │   selection
```

On Prospects the filters, and the search text, live in the URL (GH #114,
`q`, #179), so a reload, a shared link or a dashboard card opens the same
list; a change replaces the URL rather than pushing a history entry, and
clears the selection. The search box itself holds its own text and writes the
URL ~300ms after the last keystroke, so a fast typist does not mint a request
per letter; an outside URL change (Effacer les filtres, Back, the sidebar)
resets the box from the URL. After the selects, an outline `Toggle`
"Hors cible signalé" (`outOfTarget=true`, GH #250) narrows the list to places
agents reported closed or off-target and no admin has fixed since; while on, its
label carries the filtered total ("Hors cible signalé : 3"). A filter the selects cannot show — several
statuses, or a due date — stays in the slot as a `secondary` Badge chip
("Statut : Nouveau, Assigné, À relancer", "Relance avant le
28 septembre 2026", a Brussels day) with a ghost × that drops just that filter;
with several statuses the Statut select reads "Plusieurs statuts", and choosing
"Tous les statuts" there clears them. A URL change from anywhere, Back or the
sidebar included, empties the selection. "Effacer les filtres" clears the URL.

### Prospects

Rebuilt on the #175 primitives for GH #179: a `ScreenHeader`, a `ScreenState`
load-failed/loading gate, and one `Surface` holding the toolbar and the rows
together — the toolbar carries its own `border-b` instead of the two-box
chrome a hand-spelled split panel used to need.

```
│ Prospects                              [Exporter en CSV] [Importer un CSV] │
├──────────────────────────────────────────────────────────────────────────┤
│ 🔍 Rechercher…  Statut ▾  Agent ▾  Source ▾            412 prospects      │
├──────────────────────────────────────────────────────────────────────────┤
│▎ ☐  Le Bouchon des Filles  Restaurant  12 rue…  Assigné  agent@…  24/09  ⋮│
│  ☐  Chez Marcel            Café        3 place…  Nouveau  —      —      ⋮│
├──────────────────────────────────────────────────────────────────────────┤
│                            26–50 sur 60   ‹ Précédent  1  2  3  Suivant › │
```

- **Search is server-side, not a client filter.** The list endpoint already
  reads `q` (G4, #176) and returns its own `total`; a client-side filter over
  a page it already holds would only ever search the 25 rows on screen. The
  request carries `q` last, after the URL's existing filters — `toQueryString`
  is the one spelling shared by the request, the screen's own URL and the
  dashboard's links, so it never grows two shapes.
- **Paging is server-side, unlike Visites' client-side pager over a held
  feed.** The endpoint already has `limit`/`offset` and a `total`, and holding
  200 rows to show 25 would bill scanned rows for nothing. The page is
  component state, not a URL param — the API reads `offset`, not `page`, and
  the GH #114 URL contract this screen must not disturb never named one. A
  filter or search change returns to page 1; a mutation that empties the
  current page (the last row on it re-statused or reassigned out) clamps back
  to the last page that still exists, the same render-time adjustment
  Visites' own pager makes. The range under the table reads "26–50 sur 60"; a
  total of 25 or fewer shows no pager at all, same as Visites.
  The selection is keyed by the URL's query **and** the page — a page turn
  empties it exactly as a filter change does, so a bulk assign never reaches
  rows the new page no longer shows.
- **Export is a CSV of the same filters** — `GET
  /api/admin/prospects/export.csv?…&q`, the button's own request, not a
  re-read of the held page. It caps at `EXPORT_ROWS` like Visites' own export;
  past the cap the server answers `x-truncated: true` and the button shows a
  warning toast naming the cap and suggesting narrower filters — the same rule
  Visites' export (#178) set.
- **Status is edge and badge.** Each row keeps the 4px leading edge
  (`STATUS_EDGE`) and shows the French label as a `STATUS_BADGE`, the tinted
  rectangle of § Badges — in the table and in the phone list alike. Colour
  never carries the status alone: the label is always there.
- **Below 768px the table becomes a list of rows**: checkbox, name, type and
  agent on a second line, the status badge, the row menu. `useIsMobile()`
  picks the layout, rather than a table that scrolls sideways or drops
  columns silently. The row menu keeps its side submenus in both, and the
  toolbar wraps onto two lines.
- **Two empty states**, each an icon tile, a title, one sentence and one
  button. No prospects at all: « Aucun prospect. Importez un CSV pour
  commencer. » with « Importer un CSV ». Filters or a search matching nothing:
  « Aucun prospect ne correspond à ces filtres. » with « Effacer les
  filtres »; when a search is set, the sentence names it. Accents and case
  do not count ([api.md](api.md)).

### Doublons

Rebuilt on the #175 primitives for GH #182: a `ScreenHeader`, a `ScreenState`
load-failed/loading gate, and one `Surface` holding the toolbar and the pairs
together.

```
│ Doublons                                                                   │
│ Ces prospects semblent désigner le même endroit…                          │
├──────────────────────────────────────────────────────────────────────────┤
│ 2 paires                                          [Relancer la recherche] │
├──────────────────────────────────────────────────────────────────────────┤
│▎Le Bouchon             Nouveau   —                Aucune visite [Garder] │
│▎Le Bouchon des Filles  Assigné   lea@example.com   3 visites    [Garder] │  12 m
├──────────────────────────────────────────────────────────────────────────┤
│▎Chez Marcel            Nouveau   —                Aucune visite [Garder] │
│▎Marcel                 Nouveau   —                1 visite      [Garder] │  Position inconnue
```

- **A pair is one list item, not two table rows.** Two stacked side rows share
  a `<li>` (with an accessible name naming both prospects), and the distance
  cell sits once beside them, spanning the pair's own height through CSS grid
  rather than a `rowSpan` table — the shape that also serves a phone width
  with no second layout.
- **"Garder" is secondary, never gold**, and carries no confirmation: a merge
  only marks the other side absorbed — each keeps its own visits
  ([prospecting](domains/prospecting.md#prospect-lifecycle)) — so nothing a
  visit recorded is lost. The success toast carries « Annuler » for 10 s,
  which unmerges the absorbed side (`POST /api/admin/prospects/:id/unmerge`)
  and asks the sweep again (GH #195). Both rows disable the moment a merge is
  in flight — or while the sweep itself is refetching, since a stale pair
  could otherwise be merged — so a second click cannot race the first.
- **Status is edge and badge**, same as Prospects: `STATUS_EDGE` on the row,
  the tinted `STATUS_BADGE` beside the agent and the visit count, which now
  carries its own word ("3 visites", "Aucune visite") rather than relying on
  a column header — the list has none.
- **The toolbar slot never swaps here** (§ One toolbar slot): Doublons has no
  filters and no selection, so the slot holds the pair count, left, and one
  secondary action, right, "Relancer la recherche", disabled while the sweep
  is fetching. It is the control the truncation Alert already points to, and
  it is why one exists: the sweep's own `staleTime` (60 s) would otherwise
  sit stale under a fresh import until something else happened to refetch it.
- **The truncation Alert stays below the Surface**, unchanged in wording.
- **The empty state is healthy, not a failure**: an icon tile
  (`CopyCheckIcon`), « Aucun doublon détecté. », one sentence, and one
  `outline` button to Prospects — the same shape as every other empty state
  in the app, reusing the shared `EmptyTile` (`src/client/admin/EmptyTile.tsx`),
  which centres icon, text and button in the card.

### The script editor

Rebuilt on the #175 primitives for GH #184. The roadmap calls this "the most
complex screen in the app": a variable-length list of typed questions,
reorderable and versioned, read by the admin composing it and the agent
answering it. It is one editor with no steps, and each question is a
**card**. Epic #174 settled that against this file's earlier "no cards": the
"no raised surface" rule is about cards around data rows, and the ledger
screens keep it. A script question is an editable unit that moves as a unit,
and the card is what makes it legible as a drag target
([DESIGN.md › Script question card](../_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md)).

```
┌───────────────────────────────────────────────────────┬──────────────────┐
│ Scripts                                               │                  │
│ Le questionnaire posé à chaque visite…                │  Versions        │
├───────────────────────────────────────────────────────┤ ┌──────────────┐ │
│ ┌───────────────────────────────────────────────────┐ │ │ Version 3    │ │
│ │ NOM DU SCRIPT  [ default              ]           │ │ │       Active │ │
│ └───────────────────────────────────────────────────┘ │ │ 14/09 · 4 q. │ │
│ Questions  2 questions     [+ Ajouter une question]   │ ├──────────────┤ │
│ ┌───────────────────────────────────────────────────┐ │ │ Version 2    │ │
│ │⠿ 1 [ Proposez-vous la livraison ? ][Oui/non ▾] ⌧  │ │ │     Inactive │ │
│ │░ ☑ Obligatoire  [L] Clé has_delivery  Modifier    │ │ │ 01/09 · 3 q. │ │
│ │░ (i) Cette clé existe déjà dans une version…      │ │                  │
│ └───────────────────────────────────────────────────┘ │ └──────────────┘ │
│ ┌───────────────────────────────────────────────────┐ │                  │
│ │⠿ 2 [ Quel système de caisse ? ][Choix unique ▾] ⌧ │ │                  │
│ │    CHOIX PROPOSÉS  [Aucun  ×] [Papier ×]          │ │                  │
│ │    + Ajouter un choix                             │ │                  │
│ │░ ☐ Obligatoire  [L] Clé pos_system  Modifier      │ │                  │
│ └───────────────────────────────────────────────────┘ │                  │
│ ┌───────────────────────────────────────────────────┐ │                  │
│ │ (i) L'enregistrement crée une nouvelle version…   │ │                  │
│ │            [ Enregistrer une nouvelle version ]   │ │                  │
│ └───────────────────────────────────────────────────┘ │                  │
└───────────────────────────────────────────────────────┴──────────────────┘
```

`⌧` is the ghost `Trash2Icon` that removes the question; `×` removes one
choice. `[L]` is the `Lock` icon and `░` the `secondary` footer.

- **The card.** Each card is a `Surface`, not `ui/card.tsx`, which belongs
  to the dashboard. The top row holds the `GripVerticalIcon` handle, the
  number in label weight, the label input and the type select, then a ghost
  remove button. Choices, for single and multiple choice, sit under that row
  in two columns from `sm`. The footer on `secondary` holds « Obligatoire »
  and the key. The handle is the only thing that drags: the card never
  lifts on hover, and it gets a shadow only while it is being dragged.
- **A saved key locks.** A question copied from the active version shows
  its key as text beside a `Lock` icon, in Archivo rather than monospace,
  with no field to type in. docs/domains/scripts.md explains why: keys are
  "stable, and never reused with a different meaning", and an answer
  already recorded under `pos_system` must stay findable under that key.
  Only a ghost **Modifier la clé** turns the key into an input and moves
  focus to it. After that, the meta line at the bottom of the footer (an
  `Info` icon) switches from « Cette clé existe déjà… » to the standing
  warning that older answers stay under the old key; it is the input's
  `FormDescription`, so a screen reader reads it with the field. The warning stays for as long as the key is unlocked and is never
  a toast, because the risk (silently orphaning old answers) lasts longer
  than a four-second message. A new question's key is suggested from its
  label as the admin types, and stays editable until they edit it by hand.
- **One primary action, and it gets a confirmation.** « Enregistrer une
  nouvelle version » is the one gold button on the screen. Everything else
  is outline or ghost. Every other admin screen avoids a confirmation
  dialog, because merging, assigning and changing a status are all either
  reversible or additive. Saving a script is neither: it silently changes
  what every agent is asked next, including mid-round. So Save opens a
  dialog that states the version number it is about to create and activate.
  While the POST is in flight, the confirm button shows a `Spinner` and is
  disabled, « Annuler » is disabled, the dialog's close button is hidden,
  and Escape and the scrim do not close the dialog, so a second save cannot
  start before the server answers the first. When the server answers, a
  toast names the saved version. If the save fails, a toast says so and the
  dialog closes with the draft intact.
- **Version history is a fact, not a feature.** The rail is a `Surface`
  listing every version with its date and question count. Active or
  Inactive is text, `success` for the active version and muted for the
  rest, and never a coloured pill. Nothing in the rail is clickable:
  restoring an old version as a starting point is not a rule the domain doc
  states.
- **Reorder works from a keyboard.** `@dnd-kit`'s `KeyboardSensor` with
  `sortableKeyboardCoordinates` sits beside the pointer sensor, so tabbing
  to the handle, pressing Space, then the arrow keys and Space again
  reorders exactly like a drag. `ScriptsScreen.test.tsx` covers it.
- **Loading and refetches.** A skeleton stands in until the scripts arrive,
  and a failed load shows `ScreenState`'s Alert with « Réessayer ». The form
  is filled from the active version once, and again after a save, never on
  a background refetch, so a refetch cannot overwrite an edit in progress.
- **Phone width.** The editor grid is one column below `lg`, and every
  column has `min-w-0`. The type select takes the full width under the
  label until `sm`, and the key input shrinks. At 390px nothing is wider
  than the viewport (#72).

### The CSV import

Redesigned after Stitch A4–A6 for the 2026-10-10 UX update. The spines own the
detail: [EXPERIENCE.md › Component Patterns](../_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md)
for behaviour and approved copy,
[DESIGN.md › Components › Admin](../_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md)
for the look, and [`key-a4-a6-import.html`](../_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-a4-a6-import.html)
for the composition in light, dark and at phone width. The Zone step below is
unchanged apart from its rail.

```
① Source ──② Fichier & colonnes ──③ Aperçu & validation     CSV
① Source ──② Zone                                          carte
```

- **One rail for both paths.** `ImportStepper` becomes a full-width rail under
  the top bar: each step is a 32px circle, then an overline ("Étape 1", or
  « En cours » on the current step) above its label, and the line between two
  steps turns gold once the step before it is done. Done is an ink circle
  with a `Check`, current is gold with its `primary-edge`, future is
  `secondary`. Colour never carries the state alone (§ The six rules): a done
  step keeps its visually hidden "(terminée)", the current one
  `aria-current="step"`, and the `nav` stays labelled « Étapes ». The CSV
  path drops from four steps to three: choosing a file and mapping its
  columns are one screen, as in Stitch A5. There is still no « Terminé »
  step; the result stays a dialog.
- **Source is two cards, not a list.** Same reasoning as the script editor
  above: "no cards" is about cards around data rows, and a source is a
  choice the admin makes once, with a short pitch each. Two equal cards side
  by side, stacked below `md`: an icon tile (`FileSpreadsheet`, `Map`), a
  tag pill, the title with a format chip, a one-line explainer, four
  `CircleCheck` bullets, then the step count and one button. Every bullet
  states something the app does today; Stitch's "Dédoublonnage live",
  "Jusqu'à 50 000 lignes" and "Filtrage par code NAF" did not. The CSV
  card's « Importer un fichier » is the one gold action and opens the file
  picker straight away; the map card's « Dessiner une zone » is secondary.
  No coloured left edge (the cards carry no status) and no watermark icon.
  An unreadable or empty file stays on Source with a destructive Alert
  under the cards.
- **Derniers imports sits under the cards.** The last 5 imports in a ledger
  table, read from `GET /api/admin/imports` (ADR-0030): Date & heure ·
  Source · Fichier ou zone · Volume · Par · Statut (« Terminé » on the
  success tint, « Interrompu » on the warn tint, each also as the row's
  leading edge), read-only, with no link to a full history. A file or admin
  redacted by the retention sweep reads « — ». « Interrompu » appears no sooner
  than `IMPORT_STALE_MS` after the last batch, and only on the next load of
  Source: the list does not poll. It reloads when an import ends.
- **Fichier & colonnes** opens with a file card (icon tile, name, size and
  line count as chips, the in-browser hint with a `Lock`, a secondary
  « Changer de fichier »), then the mapping table: Champ (icon, label and a
  one-line hint) · Colonne du fichier · Exemple · Statut. Statut is one chip
  per row, the field's own chip first: « Requis » on Nom (destructive tint),
  « Coordonnées GPS » on Latitude and Longitude, « Clé unique » on
  Identifiant source (warn tint); on the other fields « Détecté » when the
  column was guessed or picked and « Optionnel » when none is chosen. A file column
  that feeds no field closes the table as a muted « Ignoré » row. The head
  counts configured fields, the foot counts lines and mapped columns. A
  bottom bar holds Retour (secondary), « Étape 2 sur 3 » in meta and the gold
  « Voir l'aperçu », disabled until Nom has a column. « Changer de fichier »
  reads the new file like Source does: a good one replaces the file and
  re-guesses the columns; an unreadable, headerless or empty one keeps the
  current file and mapping and shows the destructive Alert under the file
  card. At phone width each field is one block.
- **Aperçu & validation** opens with a `secondary` summary banner
  (« {124} valides sur {128} lignes » and the detected separator as a chip)
  and two KPI-style count cards, lines to import and lines rejected, each
  with its share as a tinted chip. The ledger keeps `STATUS_EDGE`:
  `status-rejected` rows first, struck through, with their reason chip;
  ready rows read « Prêt », or « Sans coordonnées » on the warn tint.
  « Toutes les lignes » / « Voir les {4} erreurs » filters it. Coordinates
  still go through `formatCoordinate` and every count through `formatCount`.
  No per-row checkboxes (every valid row is sent) and no created/updated
  forecast: that split is only known after, in the result dialog.
- **Running** floats a progress card bottom right over the bottom bar:
  « Import en cours », "{done} / {total}" in `.tnum`, and a `Progress` bar in
  ink, not gold (the gold-progress exception is daily progress and Taux de
  conversion only). Retour and « Importer {n} lignes » disable until the
  server answers the last batch. The `beforeunload` guard is registered for
  exactly as long as `useImportBatches().isRunning` is true; an in-app
  sidebar click is a router navigation, which `useBlocker` would catch but
  needs a data router, so it stays out of scope.
- **Done and failed mid-way** are unchanged: the « Import terminé » dialog
  (created · updated · rejected, the rejected count the run sent with its
  log; on the map path, « {n} lieux sans nom rejetés »), and on a failed batch a destructive Alert
  that names how many rows went in (`copy.import.failedAfter`) with
  « Réessayer ». Retour clears that failure, and a retry re-sends every row
  from the start, which is safe because the batch write is idempotent
  (CLAUDE.md invariant 4).
- **Phone width.** The cards stack, the rail names only the current step,
  the mapping table becomes one block per field, and Derniers imports
  becomes rows (date, source and file, then volume and statut, without Par).

### The map import

The map is a **source, not a screen**. `ingestion.md` opens with "two sources,
one pipeline", and the band already carries six links — so drawing an area is a
first step inside **Import**, not a seventh nav item:

```
Source → Fichier & colonnes → Aperçu & validation     CSV
Source → Zone                                         carte
```

Step one asks one question, « D'où viennent les prospects ? », and the two
answers are a file and a map. After that the CSV path is untouched.

**Which map provider is a choice inside the map step, not a third answer here**
(ADR-0020). The fork is about where the data comes from *as a workflow* — a
spreadsheet or a canvas — and OpenStreetMap and Google are the same workflow. A
three-way source step would also make the admin pick a provider before seeing a
map, which is the one moment they have no information to pick with.

The map path is one screen, because the polygon and the result are the same
question asked twice:

```
┌────────────────────────────────────┬─────────────────────────────┐
│ Données [ OpenStreetMap        ▾]  │ 47 lieux trouvés            │
│ Gratuit et sans limite. Couver…    │                             │
│                                    │ 6 sans nom                  │
│         [ Leaflet canvas ]         ├─────────────────────────────┤
│                                    │ L'Estaminet       Restaurant│
│          ·———·———·                 │ 12 rue des Bouchers         │
│         /         \                │ Chez Marcel       Café      │
│        ·           ·               │ 3 place Saint-Géry          │
│         \____·____/                │ ⌁ Sans nom        Bar       │
│                                    │   4 rue Neuve               │
│  © les contributeurs OpenStreetMap │ …                           │
├────────────────────────────────────┼─────────────────────────────┤
│ 7 sommets   [Annuler le dernier]   │                             │
│             [Effacer]              │ [ Importer 41 prospects ]   │
│        [ Rechercher dans la zone ] │                             │
└────────────────────────────────────┴─────────────────────────────┘
```

And on the Google provider, the same screen with a circle:

```
┌────────────────────────────────────┬─────────────────────────────┐
│ Données [ Google Places        ▾]  │ 20 lieux trouvés            │
│ Chaque recherche Google compte…    │ ⚠ Google renvoie 20 lieux   │
│                                    │   au maximum…               │
│         [ Leaflet canvas ]         ├─────────────────────────────┤
│                                    │ L'Estaminet       Restaurant│
│              ╭───────╮             │ Rue des Bouchers 12, 1000   │
│             │    ·    ●            │ Café du Sablon        Café  │
│              ╰───────╯             │ Rue de Rollebeek 9, 1000    │
│                                    │ …                           │
│  © les contributeurs OpenStreetMap │ Résultats fournis par Google│
├────────────────────────────────────┼─────────────────────────────┤
│ Rayon 300 m · Faites glisser…      │                             │
│                     [Effacer]      │ [ Importer 20 prospects ]   │
│        [ Rechercher dans la zone ] │                             │
└────────────────────────────────────┴─────────────────────────────┘
```

Eight rules this encodes, and four more for the second provider:

- **Side by side, because the list is the verdict on the polygon.** A wizard
  step would hide the map at the moment the admin learns the area was wrong.
  Here a thin result — or forty restaurants from the wrong arrondissement — is
  answered by moving a vertex and searching again, with both halves on screen.
  This is the one admin screen where two things compete for attention on
  purpose; the split is the point.
- **Leaflet owns the canvas, and nothing else.** Every control around it is
  shadcn (roadmap). The map has no Leaflet zoom buttons styled to look like
  ours and no custom toolbar inside the canvas: the actions sit under it, in the
  screen's own language.
- **One toolbar slot, under the map.** Same rule as §128, applied to a half
  screen: vertex count on the left as a standing fact, the search action on the
  right. It is never a floating bar over the canvas. The action group wraps
  onto its own line rather than forcing a horizontal scroll below ~480px — the
  slot is `flex flex-wrap`, and the actions are their own `flex flex-wrap`
  group.
- **The shape is drawn in colours that do not follow the theme.** The stroke,
  fill and drag handles read `--map-stroke` / `--map-fill` / `--map-handle`,
  declared once in the light `:root` and never redeclared for dark. The tiles
  are OpenStreetMap's own raster images and stay light whichever theme the
  admin chrome is in, so a shape drawn from `--color-ring`/`--color-primary`
  (which invert for dark mode) goes near-white over tiles that never do. This
  is the one surface in the app where a token deliberately does not follow the
  theme.
- **The candidate list is a ledger, not a preview table.** It reuses the leading
  edge — `status-new` for a place that will be imported, `status-rejected` for
  one that cannot be — so the panel scans the same way the prospect list does,
  at half the width. No cards, no checkboxes-as-chrome.
- **A place without a name is shown and inert.** OSM has plenty of unnamed
  amenities, and `ingestion.md` asks for them to be visible so the admin can see
  what the area really holds. But `name` is required by `importRowSchema`, so an
  unnamed candidate cannot be imported: it is listed greyed, struck, with
  « Sans nom » as its reason — exactly how the CSV preview renders a rejected
  line — and the import count excludes it. Naming one inline is a real feature
  and not this one.
- **Attribution is Leaflet's own control, not our chrome.** `copy.attribution`
  is passed to the tile layer's `attribution` option, so it moves with the map
  and cannot be laid out away by accident (INVARIANT 11).
- **Drawing is pointer-only, and that is stated rather than hidden.** Placing a
  vertex is a click; Leaflet gives keyboard pan and zoom but no keyboard vertex.
  The mitigation is that **the CSV path is fully keyboard-reachable and imports
  the same prospects** — the source step is the accessible fork, not an
  afterthought. Making the polygon keyboard-editable is worth doing and is not
  in M4.
- **A cached answer says so, with its age.** Overpass and Google results are
  both cached (ADR-0008, ADR-0020); a result served from cache reads
  « Résultat en cache, obtenu il y a N jours » (or "… il y a N heures" under a
  day), because "I searched twice and got the same 47" should be explainable
  without reading the Worker. The age comes from `cachedAt`, an additive and
  optional field on the response (docs/api.md) — a cache hit that carries no
  age still reads as a plain « Résultat en cache. ».
- **The candidate list is bounded and scrolls, and the live feed's is not.**
  That looks like two answers to one question; it is one answer to two. Here the
  two halves have to stay aligned or the split stops working — a hundred results
  in an unbounded list would push the map off screen, and "move a vertex and
  search again" is exactly what the admin does while reading them. The feed has
  no second column to stay level with, so it takes the page's own scrollbar.

Four more, from ADR-0020:

- **The provider sits above the map, not in the toolbar under it.** The toolbar is
  one slot and it holds actions; the provider is not an action, it decides what
  the canvas *is*. Putting it above keeps the §128 rule intact and puts the choice
  before the thing it changes, in reading order.
- **The gesture follows the API, and the API is why.** Overpass takes a polygon
  and Google takes a circle, so the canvas draws a polygon or a circle. The first
  click on an empty circle canvas places one at a small default radius rather than
  leaving a lone pin: a click that produces no visible shape reads as a map that
  swallowed it. The second click sets the radius, and two handles — centre and
  east — move or resize it afterwards, the same grab-a-dot grammar as a vertex.
  « Annuler le dernier point » is hidden for a circle, which has no history to
  walk back.
- **Changing the provider starts the drawing over.** A polygon is not a circle, and
  the previous provider's results left beside a blank canvas would read as an
  answer about the new one. This is the one control on the screen that discards
  work, which is why it is a select the admin opens deliberately and not a toggle.
- **Cost is a standing fact, not a warning.** Under the choice, in the muted
  register the sync indicator uses: « Chaque recherche Google compte dans le quota
  mensuel. 20 lieux maximum par cercle. » It is true for hours, it changes what
  the admin draws next, and an alert would be shouting about something nothing has
  gone wrong with. The truncation message is different — it is a result, so it is
  an `Alert` beside the results it describes. And a missing key is neither: it
  says that nobody configured the provider and that OpenStreetMap is right there,
  because « Google n'a pas répondu » would send the admin to refresh a page that
  will never work.

#### A place that looks already listed

The same restaurant can come from OpenStreetMap and from Google under two ids, and
the dedupe key cannot see it ([ingestion](domains/ingestion.md#duplicates-across-providers)).
The server compares every answer with the list; the panel shows what it found:

```
┌─────────────────────────────┐
│ 3               2           │
│ 3 lieux trouvés 2 semblent  │
│                 déjà dans…  │
├─────────────────────────────┤
▌Le Bouchon        Restaurant │  ← warn edge
▌12 rue des Bouchers          │
▌Semble déjà dans la liste :  │
▌Le Bouchon                   │
│Pizza Vera   Restauration r. │  ← status-new edge
▌Sans nom                Bar  │  ← status-rejected edge
├─────────────────────────────┤
│ ☐ Importer aussi les 2 lieux│
│   qui semblent déjà dans la │
│   liste                     │
│   Un doublon importé se     │
│   fusionne ensuite…         │
│ [Retour] [Importer 1 prosp.]│
└─────────────────────────────┘
```

- **A third kind of row, on the same edge.** `status-new` imports, `status-rejected`
  cannot, and `warn` means "look first": the colour `follow_up` already uses for
  "someone owes this a look". The edge never speaks alone: the row names the listed
  prospect it looks like, so the admin can judge the match without leaving the screen.
- **Out by default, in with one box.** The import count and the button leave the
  flagged places out. One checkbox under the list takes them all back, and the
  button's count follows it. It is not a checkbox per row: the list stays a ledger
  (no checkboxes-as-chrome), and a wrong call is cheap either way. A place left out
  can be imported by searching again, and one imported by mistake is what the
  Doublons screen merges.
- **The opt-in belongs to one answer.** A new search starts unchecked again. Ticking
  the box for one area must not quietly apply to the next.

### The live feed

The roadmap sketched this as shadcn `card` + `badge` + `scroll-area`. **It is a
ledger instead**, for the reason at the top of this file: no cards around rows,
no status as a coloured pill. The feed is the prospect list with time as its
spine, **one row per door-day**: one agent, one prospect, one Brussels day,
showing that day's latest visit
([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md) › Admin
and stats count door-days). Shipped by entry 11 of the numbered-tournée epic
(#507): the rows and their history read [api › The live feed](api.md#the-live-feed),
and the figures count door-days since entry 10 ([api](api.md#the-dashboard)). Mockup:
[`key-t4-visites-ledger.png`](../_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-t4-visites-ledger.png).

```
│ Visites            312 visites  [7 j|30 j|90 j]  [Exporter en CSV] │
│                    Raison du refus [Toutes les raisons ▾]          │
│ Une ligne par prospect et par jour, avec son dernier résultat.      │
│ Ouvrez une ligne pour voir chaque visite.                           │
│                                                                     │
│ RELANCES DUES     TAUX DE          FLYERS REMIS    AGENTS EN        │
│ SOUS 7 JOURS      CONVERSION                       TOURNÉE          │
│ 12                10,6 %           84              2                │
│ Avant le 4 oct.   38 convertis…    Sur la période  Aujourd'hui      │
├─────────────────────────────────────────────────────────────────────┤
│ 14/10 16:42  Le Bouchon     Intéressé  Flyer  agent@…              ⌄  │
│ 14/10 16:12  Pizza Roma     Converti   Flyer  agent@…   2 visites  ⌃  │  opened
│          VISITES DE LA JOURNÉE                                      │
│          14/10 10:02  Personne sur place  « Fermé, repasser… »      │  oldest first
│          14/10 16:12  Converti  Flyer remis · 4 réponses · « … »    │
│ 15:58  Chez Marcel    Pas intéressé  Pas besoin…  agent@…    ⌄      │
│ 14:40  Pizza Vera     Personne sur place  agent@… 3 visites  ⌄      │
├─────────────────────────────────────────────────────────────────────┤
│              ‹ Précédent   1  2  …  13   Suivant ›                  │
└─────────────────────────────────────────────────────────────────────┘
```

Since GH #178 the screen has three parts above the ledger's own six rules: a
period selector, a four-card KPI strip and a 25-row pager, plus a CSV export.

- **The selector is a 7/30/90 window, not an arbitrary range** — the same
  `PeriodToggle` as Tableau de bord, held in the URL (`?period=`, default 30,
  and any other value treated as 30) so a reload or the dashboard's Visites
  card opens the same window. Changing it replaces the URL, scopes the feed's
  request to that window's `from`/`to` (`brusselsPeriod`, sent as `to − 1`
  because the feed's own bounds are inclusive), reseeds the cursor from
  `since=0`, and returns to page 1 — with no wash and no arrival
  announcement for that reseed, since refilling the ledger under a new window
  is not news the way an actual arrival is.
- **The strip reads the same aggregate as Tableau de bord, scoped to the same
  period** — `GET /api/admin/dashboard?period=`, not the 500-row-capped feed:
  Relances dues sous 7 jours (linked to Prospects `status=follow_up` at that
  boundary), Taux de conversion (linked to Prospects `status=converted`,
  every prospect converted now, matching the dashboard's own Convertis link),
  Flyers remis and Agents en tournée, both plain cards. Four compact cards in
  one row, no icon tile, no sparkline: overline label, display figure, one
  meta line — the same shape as the dashboard's own KPI cards without their
  icon or footer chart. A failed aggregate shows `ScreenState`'s inline Alert
  with a retry in the strip's place; the ledger below is unaffected, since it
  is its own feed request.
- **The pager is client-side over the held feed**, 25 rows at a time,
  "Précédent", page numbers with an ellipsis past a handful, "Suivant" — no
  server paging exists on the feed and none may be added (the feed still caps
  at `ADMIN_VISITS_PAGE_SIZE`, and past it the count itself reads "500
  visites ou plus" rather than a number that looks exact but is not). The
  page scrolls; the table never gets its own scroll area. An arrival while
  paged in does not move the reader off their page.
- **Export is a CSV of the same window** — `GET
  /api/admin/visits/export.csv?from&to`, the button's own request rather than
  a re-read of the held feed. Both stop at 500 rows, but each at its own cap:
  the ledger at `ADMIN_VISITS_PAGE_SIZE`, the export at `EXPORT_ROWS`. Past its
  cap the server answers `x-truncated: true`; the button shows a warning toast
  naming the cap and suggesting a shorter period, the same rule Prospects'
  export (#179) follows.
- **Raison du refus narrows the ledger and its export alike** (GH #249) — the
  shared `prospects/Filter` select beside the period, held in the URL
  (`?reason=`, one of the 7 refusal reasons; any other value reads as Toutes
  les raisons). A change reseeds the feed exactly as a period
  change does, and every poll and the export carry the same `reason=`. On the
  ledger it keeps the door-days whose latest visit has that reason, the one a
  refusal count reads (R12); the export, one row per visit, keeps the visits
  that have it. A
  refused visit shows its reason's label, muted, right after Pas intéressé;
  a refusal without one shows nothing extra. The strip stays on the whole
  period, since its figures are not refusals.

**A row is the door-day's latest visit**, the one with the greatest clamped
`visited_at`, the same visit every door-day figure reads (ADR-0036); rows are
ordered by the greatest `received_at` among the door-day's visits (the spine,
below). Its time is the door-day's latest arrival, the spine it is sorted by;
its outcome, refusal reason and note are the latest visit's; « flyer » shows
when any visit of that door-day left one (R12); the agent is the door-day's own. A door-day with more than one
visit adds a muted, tabular « {2} visites » before the chevron. The lede under
the title says the unit once: « Une ligne par prospect et par jour, avec son
dernier résultat. Ouvrez une ligne pour voir chaque visite. », replacing « Les
visites arrivent ici dès qu'un agent synchronise. »; the header count
(« {312} visites ») counts door-days, the same unit as Tableau de bord's
Visites but not the same figure: the ledger picks door-days by their arrival in
the window, the dashboard by the day they were made.

**Opening a row shows every visit, in place.** The whole row is a disclosure
button named « {name}, {outcome}, {2} visites. Voir les visites » (without
« {n} visites » for one), with `aria-expanded`, `aria-controls` and a
`ChevronDown` that turns up, never
a dialog or a sheet: EXPERIENCE.md keeps dialogs for the three confirmations,
and reading a history confirms nothing. It expands under the row, on a
`secondary` wash, an overline « Visites de la journée », then one line per visit,
oldest first: date and time (`visited_at`, as the agent saw it), the outcome
badge, then what that visit carried: « Flyer remis », « {4} réponses », the
refusal reason, the note in quotes. A one-visit door-day opens the same way, so
its note and answers are always one click away. At most one row is open at a
time, like a stop row; the open row stays open across polls, and an arrival on
that door-day adds its line to the history. A change of period, reason or page
closes it. Visits are never edited or deleted
here (ADR-0007).

**The CSV export stays one row per visit.** It is the raw history, so a
door-day with two visits is two lines in the file and one row on screen;
the button and its truncation rule are unchanged.

Six rules the ledger itself still encodes:

- **An arrival is ambient, never a toast.** Principle 8 was written for the
  field side but the logic is the same here: a visit that landed is a fact that
  stays true, and the admin who was making coffee should find it on the list
  rather than have missed it. `sonner` stays for things the admin *did*.
- **The edge is the latest outcome's consequence, not the outcome.** A row's leading
  edge uses `STATUS_EDGE[OUTCOME_TO_STATUS[outcome]]`, so the column scans as
  "what does this leave me to do" — `À relancer` mustard, `Intéressé` faded
  green, `Converti` green, `Refusé` red. The outcome's own French label sits in its column, because
  colour never carries the information alone.
- **Time is the spine.** The feed orders door-days by the greatest
  `received_at` among their visits, not `visited_at` —
  the server's clock, not the phone's, because a phone's clock can be wrong
  (INVARIANT 12) and the feed's promise is "what has reached me". Times are
  `.tnum` and left, where the prospect list puts numbers right: this column is
  read down as a sequence, not compared as quantities.
- **A new row is marked once and then settles.** Principle 5 allows motion where
  something changed, so an arriving row holds a brief wash and releases it. A
  second visit to a door-day already listed is an arrival too: its row moves to
  the top with the new outcome and washes once.
  Under `prefers-reduced-motion` it appears without the transition — it is never
  the only signal that the row is new.
- **No scroll-area.** A pane with its own scrollbar inside a page that also
  scrolls is two scrollbars and a lost keyboard. The page scrolls; the feed is
  the page.
- **A visit to a merged prospect still appears.** Every other admin list filters
  `merged_into IS NULL`, but this one records what agents did, and an absorbed
  prospect keeps its visits (`prospecting.md`). The name shown is the one the
  visit was made against.

Empty, it is an invitation like every other empty screen: « Aucune visite reçue.
Les visites apparaissent ici dès qu'un agent synchronise. », in the shared
`EmptyTile` with an inbox icon and no button.

### The repair queue

Visits the server took but could not place
([ADR-0022](adr/0022-quarantine-visits-the-server-cannot-take.md)). The screen
asks one question and only one: **where does this visit belong?** Everything
else on the row is evidence for answering it. Rebuilt on the #175 primitives
for GH #183: a `ScreenHeader`, a `ScreenState` load-failed/loading gate, and
one `Surface` holding the rows.

```
│ Visites à rattacher                      3 visites pas encore rattachées │
│ Ces visites sont conservées, mais elles ne comptent pas encore. …       │
├──────────────────────────────────────────────────────────────────────────┤
│▎24/09 16:42 [Converti] [✓ Flyer remis] lea@…      [Prospect introuvable] │
│▎« patron absent, repasser jeudi »                                        │
│▎Rattacher à [Pizza Roma · 40 m] [Roma Express · 120 m]      🗑 Supprimer │
├──────────────────────────────────────────────────────────────────────────┤
│▎24/09 15:12 [Pas intéressé] francois@…      [Prospect d'un autre agent] │
│▎Rattacher à [Le Comptoir · 30 m]                            🗑 Supprimer │
├──────────────────────────────────────────────────────────────────────────┤
│▎24/09 11:05 [Intéressé] lea@…                     [Prospect introuvable] │
│▎Aucune position enregistrée pour cette visite : aucun prospect à        │
│▎proposer. Si elle ne peut pas être rattachée, supprimez-la. 🗑 Supprimer │
```

- **A forecast, not a record.** The edge is
  `STATUS_EDGE[OUTCOME_TO_STATUS[outcome]]`, as on the live feed, so a
  `Converti` waiting here already reads green. That is the one thing on the row
  that could mislead, so the header count ("3 visites pas encore rattachées")
  and the lede carry the correction once for every row, not a badge on each.
  The outcome itself is the outcome badge, so the colour never speaks alone.
- **Two reasons, one row shape, no dialog per row.** Line one is the evidence:
  time, outcome, "Flyer remis", agent, and the reason as an outline badge far
  right. Line two quotes the note. Line three is always "Rattacher à" and its
  buttons, then "Supprimer". `Prospect introuvable` offers a choice between
  candidates; `Prospect d'un autre agent` offers one button, the prospect the
  visit already named (with its distance when the server ranked it too), even
  when the visit recorded no position. If the server can no longer name that
  prospect (merged away since), the row falls back to the candidates. A
  dialog per row would turn a queue of five decisions into five journeys.
- **The server proposes; the admin does not search.** Candidates are the
  nearest live prospects to where the visit was recorded, in the server's
  order, nearest first. There is no prospect picker in this app and this
  screen does not earn one. A visit with no recorded position gets no
  candidates, and the row says so in words rather than showing an arbitrary
  list that would invite a wrong answer. A visit with a position can still
  get none when no live prospect has one; `hasPosition` lets the row say
  that instead of blaming the visit (GH #197).
- **Distance is inside the button.** It is the reason to press *that* button,
  so it belongs inside the target, not three columns away.
- **Every row action is secondary, never gold.** Candidates are repeated row
  actions ([the UX spine's buttons rule](../_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md)),
  so the Stitch mock's gold "Rattacher à …" is not kept. "Supprimer" is a
  ghost button with destructive text and a trash icon, far right and away
  from the attach buttons, because a misclick there is unrecoverable. It
  opens the confirmation, the `ScriptsScreen` dialog pattern, whose body
  names the consequence and whose confirm is `destructive`; while the delete
  is in flight the dialog cannot be dismissed and the row stays locked. It is
  the one place this app deliberately loses a visit.
- **Each row owns its repair.** A row holds its own `useRepairOrphan`, so a
  repair in flight disables that row's buttons only, its "Supprimer"
  included, and the rest of the queue stays live. One screen-level mutation
  would track only its latest call, and two quick repairs would clobber each
  other's pending state. Rows do not lock while the queue refetches (unlike
  Doublons): a repeated repair answers `repaired: false` and a repeated
  discard is a no-op.
- **The toast reports what the server did.** It names the chosen prospect, or
  says the visit went to the prospect that absorbed it (the server followed a
  merge) or was already attached (`repaired: false`), never more than it knows
  (GH #199).
- **One total, everywhere.** The header count, the sidebar badge and
  Tableau de bord's "À traiter" all read `visits.length + remaining`
  (`orphanTotal` in `nav.ts`), so a queue longer than one page (200) is never
  undercounted (GH #159). A non-zero `remaining` also prints a line under the
  list: the answer is upstream, not a bigger page.

Empty is the healthy state, so it reads as reassurance rather than a failure:
the shared `EmptyTile` with « Aucune visite à rattacher. », « Tout ce que les
agents ont envoyé est arrivé à destination. » and one `outline` button to
Visites.

### The admin round view

`/admin/round`, last in Terrain: where an agent's tournée stands today, without
phoning them. An agent `Select` (kept in `?agent=`, which wins; without one, the
agent last chosen on this browser is restored from `localStorage`, and the URL
stays plain), then a read-only list of that agent's stops still to do, under the
numbers the swipe gave them
([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)). The stored
position ([ADR-0028](adr/0028-agent-position-at-sync.md)) only places the marker
and the distances.

```
Tournée du jour                                   12 arrêts
Agent [lea@example.com v]  Position du 24/09/2026 15:24
+---------------------------------------------------------+
|#1 Pizza Roma                [Assigné]              120 m |
|   Restaurant · 4 rue Neuve                               |
|#3 Chez Marcel              [À relancer]            340 m |
+---------------------------------------------------------+
```

From `md` the list and the map sit side by side:

```
+----------------------------+ +----------------------------+
|#1 Pizza Roma     120 m     | |  (map, sticky)             |
|#3 Chez Marcel    340 m     | |   (1)--(3)   (o)           |
+----------------------------+ +----------------------------+
```

- Rows are the server's stops still to do, in number order: no visit today and
  not left (reassigned, closed or merged), as the phone's Tournée and Carte list
  them. Numbers are the swipe's, so a visited stop 2 and a reassigned stop 4
  read 1, 3, 5. `round-map.ts` builds the pins and the path as Carte does; no
  re-sort, no Plus tard group. The header counts the rows. A stop leaves this
  list once its visit has synced: while the visit sits in the phone's outbox, the
  server cannot see it and the list lags the phone.
- Read-only: no Visiter, Y aller, swipe, expand or link on a row. Rows reuse
  `StopNumber`, the status leading edge and the ledger status badge. No
  « Nouveau » badge or counter.
- Before the swipe: « {email} n'a pas encore commencé sa tournée aujourd'hui. »,
  no rows, no count, and the map holding the position marker only. Open prospects
  are not listed in its place. A tournée whose stops are all done or left shows
  « Aucun arrêt dans la tournée du jour de cet agent. »
- No position today: the same rows and numbers, no distances, and the notice
  « Aucune position reçue aujourd'hui. » (not shown on an empty list).
- A stop without coordinates keeps its number and draws no pin.
- The map pane sits beside the list (the field's `RoundMap`, no re-centre
  button, pins decorative). The next stop's pin (the lowest number) is gold when that
  stop has coordinates, and the dashed path runs through the pins in number
  order, with or without a position; the
  position marker is drawn only when a reading exists. The map fits the stops,
  not the position, so a reading far from them never shrinks them: the marker
  is drawn wherever it falls. It mounts for any loaded round (zero pins: the
  Brussels view, or centred on the position when there is one) and remounts, so
  refits, when another agent is chosen. Below `md` it comes first at a fixed
  280 px, then the list; from `md` the list is on the left and the map on the
  right, 80 % of the viewport tall and sticky.

### Utilisateurs

`/admin/users`, second in Pilotage (Lucide `Users`): who may sign in, and on
which devices ([ADR-0029](adr/0029-own-login-instead-of-cloudflare-access.md)).
Adding an agent is one form here, with no deploy. Built on the #175
primitives: a `ScreenHeader`, a `ScreenState` gate and one `Tabs` (shadcn)
over the rows: « Agents » (the default) and « Administrateurs », each with
its active count. A role is fixed at creation
([ADR-0037](adr/0037-admins-leave-the-field-side.md)), so the tab names it
and there is no Rôle column. Mockups: forge
`utilisateurs-screen-rethink`, `mockup-b-nom.png` (desktop) and
`mockup-b-phone.png` (phone), under `_bmad-output/forge/`.

```
  Utilisateurs                                 [Ajouter un utilisateur]
  Qui peut se connecter, et sur quels appareils.

  ( Agents 3 | Administrateurs 2 )
┌─────────────────────────────────────────────────────────────────────┐
│ Nom                                  Inscription         Appareils  │
│ › Léa Dupont                         Inscrit                  2   ⋮ │
│   lea@example.com                                                   │
│     iPhone · Safari  Inscrit le 24/09  Vu le 07/10 15:24 [Révoquer] │
│ › Marc Peeters                       Pas encore inscrit       0   ⋮ │
└─────────────────────────────────────────────────────────────────────┘
  › Désactivés (1)
```

- **Header.** "Utilisateurs", lede "Qui peut se connecter, et sur quels
  appareils.", and one `default` Button, "Ajouter un utilisateur".
- **Adding opens a `Dialog`** titled "Ajouter un utilisateur", a shadcn
  `form` (ADR-0018) whose resolver is a `z.pick` of the shared schema:
  "Adresse e-mail", "Nom", and "Rôle" as a `Select` of "Agent" (the default)
  and "Admin" (the [glossary](glossary.md)'s word); "Ajouter" and "Annuler". Its messages: "Saisissez une
  adresse e-mail valide." and "Saisissez un nom." The address is trimmed and
  lowercased before it is sent, as `users.email` is. The new row appears at
  once as "Pas encore inscrit", with the toast "Utilisateur ajouté."; the next
  step is its "Générer un code". An address that already has a user is
  refused with "Cette adresse a déjà un compte. S'il est désactivé,
  réactivez-le sous Désactivés." Users are never deleted, so a typo is fixed
  by deactivating the wrong row.
- **Two tabs**, « Agents » then « Administrateurs »: a `TabsList` on a
  `secondary` track, the selected trigger lifted onto `card` with a shadow
  (as `PeriodToggle`), each with its active count in meta, tabular. Agents
  opens on every visit and the choice is not in the URL. Below 768px the
  list is full width, two equal halves. After adding a user, the tab their
  row lands in is selected. An Agents tab with no active agent holds one
  muted line in its `Surface`, "Aucun agent. Ajoutez-en un pour lancer les
  tournées."; Administrateurs is never empty (you are in it).
- **One row per active user**, by name. Nom is the name, the email
  under it in meta. Inscription is a badge: "Inscrit" (`tint-success`) when
  the user has at least one live session, "Pas encore inscrit" (`secondary`) otherwise.
  Appareils is the count of live sessions in tabular figures. The signed-in admin's own row carries
  "Vous" in meta after the email.
- **The row expands to its devices.** A chevron before the name opens one
  line per session under the row: the device label ("iPhone · Safari"),
  "Inscrit le 24/09/2026" and "Vu le 07/10/2026 15:24" in meta, and a ghost
  "Révoquer" that signs that device out on its next request, with no
  confirmation — a new code re-enrols it — and a toast "Appareil
  déconnecté." The device this page is open on reads "Cet appareil" instead
  of a Révoquer button: "Se déconnecter" in the avatar menu is how it signs
  out. With no session, the expanded row says "Aucun appareil inscrit." A
  session whose User-Agent gave no summary is labelled "Appareil inconnu".
- **The row menu** (`DropdownMenu`, `MoreVertical`) holds, in order:
  "Générer un code" and, after a separator, "Désactiver" in
  `destructive`. There is no role item: a role is fixed at creation
  ([ADR-0037](adr/0037-admins-leave-the-field-side.md)). On the last active
  admin's row, "Désactiver" is disabled with "Il faut au moins un
  administrateur actif." in meta under it; should the server still refuse
  (another admin acted first), that sentence is the error toast. Any other
  failed action on this page — add, revoke, code, deactivate,
  reactivate — keeps the screen as it was and toasts "L'action n'a pas abouti. Réessayez."
- **The code `Dialog`.** Titled "Code pour {nom}". The eight characters in
  `text-display`, tabular, split 4 + 4 by a space ("K7QM 2XPA" — the
  normaliser ignores spaces), with "Valable jusqu'à {heure}, une seule fois."
  under it, `{heure}` the code's expiry as the server returns it, in Brussels
  time, so a wrong device clock cannot misstate it. Then "Ce code ne sera
  plus affiché. En générer un autre annule celui-ci." in meta, a `secondary`
  "Copier" (toast "Code copié.", or "Copie impossible. Recopiez-le à la
  main." when the clipboard refuses; the code stays on screen either way) and
  a `default` "Terminé". Closing it any way
  is fine: the code still works until it expires or is used. An admin enrols
  another of their own devices with the same item on their own row.
- **Deactivating asks first**, in an `AlertDialog`: "Désactiver {nom} ?",
  then one of "{n} prospects restent assignés à {nom}. Réassignez-les depuis
  « Prospects sans agent actif » au Tableau de bord.", "1 prospect reste
  assigné à {nom}. Réassignez-le depuis « Prospects sans agent actif » au
  Tableau de bord." or "Aucun prospect n'est assigné à {nom}."; on an agent's
  row, "Demandez-lui d'abord de synchroniser son téléphone : une visite qui
  n'est pas encore partie ne pourra plus l'être."; and always
  "Ses appareils seront déconnectés et son code annulé. Vous pourrez le
  réactiver." "Annuler" and a `destructive` "Désactiver"; done, the toast
  says "Utilisateur désactivé." The count is the user's prospects still
  assigned, refetched when the dialog opens; the story that adds the users
  routes names its field in [api.md](api.md). Deactivating your own row
  (allowed when another admin is active) signs you out.
- **Désactivés.** Under the selected tab's `Surface`, a ghost Button
  "Désactivés ({n})" with a chevron and `aria-expanded` shows a second list
  of that tab's deactivated users only, with the same columns,
  names in `muted-foreground`, no devices (deactivation deleted them), and
  one action per row, a `secondary` "Réactiver". A reactivated user returns
  to the active list as "Pas encore inscrit" and needs a new code; the toast
  says "Utilisateur réactivé." The button
  is absent from a tab with no deactivated user. Each tab remembers
  whether its list is open.
- **Below 768px** the table becomes a list of rows, as on Prospects
  (`useIsMobile()`): name and badge on the first line, email on the
  second, the device count and the row menu on the right. A device line
  wraps under its label: dates on one line, "Révoquer" on the right. Each
  tab and its Désactivés list take the same shape.
- **Loading and failure** go through `ScreenState`: skeleton rows with a
  visually hidden "Chargement des utilisateurs…", or "Impossible de charger
  les utilisateurs." with "Réessayer". The only empty state is the Agents
  line above.

## Principles

1. The list is the product. Chrome yields to rows.
2. Status is structural before it is textual.
3. One toolbar slot.
4. Numbers are tabular and right-aligned.
5. Motion only where something changed — the toolbar swap, a row settling after
   assign. Nothing fades in on scroll, nothing animates on hover by default.

## Writing

Covered by CLAUDE.md and the [glossary](glossary.md): sentence case, active
verbs, French in `src/client/copy.ts` only. Two habits worth naming here:

- An action keeps its name through the whole flow. The button that says
  « Assigner » produces a result that says « Assigné ».
- An empty screen is an invitation, not a shrug: « Aucun prospect. Importez un
  CSV pour commencer. », with the button right there.

## Working with shadcn in this repo

Two things the CLI gets wrong here, both worth knowing before the next
`pnpm dlx shadcn@latest add`:

- It resolves the `@` alias from the **root `tsconfig.json`**, which is an empty
  stub that compiles nothing. The `paths` entry there exists only for the CLI;
  without it, components are written to a literal `./@/ui/` directory.
- Recent versions import `cn` from an npm package of that name rather than from
  the `utils` alias. Repoint them at `@/lib/utils` and do not keep the package —
  we already have that function.

Vendored components are our code (ADR-0014): they are linted and formatted like
everything else, their `"use client"` directives are stripped because nothing
here is Next.js, and `sonner.tsx` reads the theme from `data-theme` rather than
carrying `next-themes` for it.

They also arrive roomier than this design wants. The ledger sets its own row
height from `--spacing-row` and zeroes the cell padding shadcn ships.

## Icons

Everything in `public/` is copied verbatim to the site root by Vite, so these
names are also the URLs. Drop the files in with exactly these names and nothing
else needs editing:

| File | Size | Why |
|---|---|---|
| `favicon.ico` | 48×48 + 32×32 | The browser tab. |
| `mark.svg` | scalable | The mark in the band, with its navy swapped for the band's foreground — a navy wheel on a navy band is 1:1. Also the login page's mark in the dark theme. |
| `mark-ink.svg` | scalable | The mark in its own navy ink (`docs/brand/logo.svg`), above the login card on the light page. |
| `apple-touch-icon.png` | 180×180 | The iOS home screen. iOS ignores the manifest's icons for this, so without it an agent's iPhone renders a screenshot of the page. |
| `icon-192.png` | 192×192 | Android install prompt. |
| `icon-512.png` | 512×512 | Android splash screen. |
| `icon-maskable-512.png` | 512×512 | Android adaptive icons, which crop to a circle or squircle. |

Two things to get right in the artwork:

- **The maskable one needs a safe zone.** Android crops it to a shape it chooses,
  so the mark has to sit inside the central 80% — a circle of 40% radius from the
  centre — and the rest must be filled background, not transparency. A normal
  icon reused here gets its edges cut off.
- **The others should not be transparent either.** A transparent PNG on the iOS
  home screen renders on black. Use white `#FFFFFF`, the manifest's
  `background_color`: Android paints its splash in that colour behind
  `icon-512.png`, and any other white shows the icon's square.

An installable PWA needs at least the 192 and the 512; a manifest with no icons
gets no install prompt, and "agents install the PWA from the phone browser"
(roadmap M6) fails silently. All six files exist, and `index.html` and the
manifest in `vite.config.ts` reference them — verified by having a browser parse
the built manifest rather than by reading it.

`favicon.svg` is deliberately **not** in `public/`. It lives in `docs/brand/`
because it is a 246 kB PNG wrapped in an SVG, and the service worker precaches
every svg it finds under `public/` — one file larger than the whole field JS
chunk, for a tab icon the `.ico` already serves.

## The login page

`/login` is where everyone signs in: an agent with a one-time code, an admin
with an email and a one-time code, each form checking the role ([ADR-0038](adr/0038-admins-sign-in-with-an-email-and-a-code.md)).
It serves both sides but ships in the field shell, since a phone with a
revoked session must reach it offline-installed. So the field rules hold:
its strings live in `copy/field`, its inputs and labels are native, its
targets are 48 px and its text `text-base`
([ADR-0015](adr/0015-native-controls-on-the-field-route.md),
[ADR-0026](adr/0026-budget-the-field-precache-not-the-entry-chunk.md)), and every byte counts toward
the 1,000 KiB precache.

```
               ⎈                                      ⎈
       Captain Prospectus                     Captain Prospectus

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓     ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
│           Connexion            │     │           Connexion            │
│   Entrez le code que vous a    │     │   Connectez-vous avec votre    │
│   donné un administrateur.     │     │   adresse e-mail et un code…   │
│                                │     │                                │
│ Code                           │     │ Adresse e-mail                 │
│ [ K7QM 2XPA               ]    │     │ [ sam@example.com         ]    │
│                                │     │ Code                           │
│ [        Se connecter       ]  │     │ [ ••••••••                ]    │
│                                │     │                                │
│     Accès administrateur       │     │ [        Se connecter       ]  │
└────────────────────────────────┘     │            Retour              │
                                       └────────────────────────────────┘
   ━━━ the card's 4px gold top edge
```

- **No band, one card.** The page is plain `background`, with no band, no
  tab bar and no sync strip. Everything is centred horizontally, and from
  `md` up vertically too; on a phone it starts 48px from the top, under the
  safe-area inset.
- **The brand sits above the card**, centred: the mark (48px wide on a
  phone, 56px from `md` up) in its navy ink, `mark-ink.svg` — the dark theme
  shows the band's light-ink `mark.svg` instead — then "Captain Prospectus"
  in `text-brand`. Type steps down from there: the name at 22/700,
  "Connexion" at 20/600, the field labels at 16/500.
- **The card** is at most 24rem wide with a 16px gutter on a phone, a soft
  shadow, and a 4px `primary` top edge — gold's one decorative use
  ([Colour](#colour)). Its header is centred: "Connexion", the page's `h1`,
  in `text-title`, and the lede under it. The fields stay left-aligned,
  then a full-width `default` Button "Se connecter", and under it the
  switch.
- **The code form is the default.** Lede "Entrez le code que vous a donné un
  administrateur." One field, "Code": `type="text"`,
  `autocomplete="one-time-code"`, `autocapitalize="characters"`, spellcheck
  off, no `maxlength`. Whatever the agent types is kept as typed — spaces,
  hyphens, lowercase, an O for a 0 — because the server's normaliser reads
  it; the client never rewrites or rejects it.
- **"Accès administrateur" swaps the form.** A ghost Button under the card's
  primary action, never a switch control: it replaces the code form in place
  with the admin one, whose own ghost Button "Retour" swaps back. The
  swap clears a refused sign-in's Alert but keeps the lockout Alert, since
  the lock is per connection, and moves focus to the first field.
  It is screen state, not a URL.
- **The admin form** has the lede "Connectez-vous avec votre adresse e-mail
  et un code généré par un administrateur." and two fields: "Adresse e-mail"
  (`type="email"`, `autocomplete="username"`) and "Code" (`type="password"`,
  `autocomplete="one-time-code"`): masked so break-glass never shows on
  screen, and `one-time-code` asks password managers not to offer to save it. Break-glass is this
  same form; nothing on screen names it.
- **Validation** is a shadcn `form` over react-hook-form like every other
  form (ADR-0018), with a `z.pick` of the login schema as resolver; it only
  checks that a field is filled: "Saisissez votre code." under either Code
  field, "Saisissez votre adresse e-mail."
- **A refused sign-in** (401) shows a destructive `Alert` above the button
  and keeps what was typed. For a code: "Ce code ne fonctionne pas. Il a
  peut-être expiré ou déjà servi : demandez-en un nouveau." For the admin
  form, one sentence whichever part was wrong, the role included: "Adresse
  e-mail ou code incorrect. Le code a peut-être expiré ou déjà servi :
  demandez-en un nouveau." A request that never reached the server says
  "Connexion impossible. Vérifiez le réseau et réessayez."; any other
  failure (a 5xx) says "Connexion impossible pour le moment. Réessayez dans
  un instant.", and a 426 shows the usual update prompt instead ("Mettre à
  jour" reloads the page when no build is waiting yet). The prompt is the
  full-width banner at the top of the page, above the brand. While a
  request is in flight the button holds a `Spinner` and is disabled.
- **Lockout** (429): the Alert reads "Trop de tentatives depuis cette
  connexion. Réessayez à {heure}, ou changez de réseau.", `{heure}` being
  `Retry-After` added to now, as a Brussels time ("15:24"). The button stays
  disabled until that time, then re-enables on its own and the Alert goes —
  no reload needed. The fields stay editable. Without a usable `Retry-After`
  it reads "Trop de tentatives depuis cette connexion. Réessayez dans
  quelques minutes, ou changez de réseau." and re-enables after 15 minutes.
  The lock is screen state: a reload forgets it, and the next attempt simply
  gets the 429 again.
- **Offline** (`useOnline()`): a standing `Alert` above the form, "Hors
  ligne. Connectez-vous dès que le réseau revient.", and the button disabled;
  the fields stay editable, and the Alert goes when the network returns.
  There is one Alert slot: offline wins it over a lockout or a refusal, which
  shows again once back online if it still holds.
- **Nothing waiting is lost.** When the outbox on this device holds visits —
  a phone sent here by a 401 — a meta line under the lede says so: "1 visite
  non envoyée est gardée sur ce téléphone. Elle partira après la connexion."
  or "{n} visites non envoyées sont gardées sur ce téléphone. Elles partiront
  après la connexion." The page only reads the outbox, never clears it
  ([field-operations](domains/field-operations.md#offline-sync)). While the
  outbox is being read, or if it cannot be, the line is simply absent.
- **After signing in**, the role from the server picks the landing: an agent
  to the round, an admin to `/admin`. Always the landing, never the page the
  401 interrupted: no return path means no redirect parameter to validate. A
  device that already has a session and opens `/login` goes straight to its
  landing.

## The field side

The admin side is a dashboard. The field side is **the tear-off** — the ticket
pulled out of the *carnet de tournée* and held in one hand.

Everything below is designed for one situation: an agent standing on a pavement
in Brussels, phone in one hand and a stack of flyers in the other, sun on the
screen, often with no signal, wanting to be done with this door and on to the
next. That situation, not the admin's, decides every trade-off here.

The palette and the typeface are not re-decided for this side. Tokens are shared
(`app.css`), the mark is shared, the band is shared. What changes is **density,
target size, and how much the screen commits to one thing at a time.**

### Before the swipe

*Built by entry 3 (the two no-tournée messages, the start screen, the swipe) and
entry 4 (the location dialog) of the numbered-tournée epic, #496.*
[ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md) › The gates
decides their order; this section decides what each one looks like. Mockup:
[`key-t1-start.png`](../_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-t1-start.png).

```
┌──────────────────────────────────┐
│ ▮ Captain Prospectus        ● 1  │  band and sync dot, as on every field screen
├──────────────────────────────────┤
│ 1 élément en attente d'envoi     │  strip: the sync is never gated
├──────────────────────────────────┤
│ MERCREDI 14 OCTOBRE              │
│ Tournée du jour                  │
│ 20 arrêts                        │
│ Les arrêts seront numérotés au   │
│ départ, du plus proche au plus   │
│ loin.                            │
│ ┌──────────────────────────────┐ │
│ │ • Bar des Marolles           │ │  a preview: no number, no distance,
│ │   Bar · Place du Jeu de Balle│ │  nothing to tap
│ │ • Chez Marcel                │ │
│ │ …                            │ │
│ │ et 13 autres arrêts          │ │
│ └──────────────────────────────┘ │
├──────────────────────────────────┤
│ (≫) Glisser pour commencer la    │  64px track, fixed at the bottom;
│     tournée                      │  no tab bar before the swipe
└──────────────────────────────────┘
```

**One screen per gate, in the ADR's order.** Signed in, the field route shows the
first of these that applies: a no-tournée message, the start screen (under the
location dialog until a reading is precise enough), or the app itself, from
Tournée. A tournée already swiped today, on this phone or pulled from the
server, skips straight to the app. None of the gate screens has a tab bar: the
tabs are the app, and the app opens at the swipe. The band, its sync dot and
the strip stay on every one of them, « Se reconnecter » included, because the
sync is never gated. The gates are agent-only: an admin never reaches the field
side (ADR-0037). An agent with nothing assigned has no Ajouter either; ADR-0036 gates the whole app on a tournée.

**Two no-tournée messages, never one.** Both are the shared empty-state shape:
a 64px `secondary` disc with a 28px icon, a title, one muted paragraph, centred,
no button (the sync runs on its own triggers, so a button would ask the agent to
do what is already happening).

- **Nothing assigned** (`Inbox`): the phone has pulled at least once, and today's
  tournée would hold no stop. « Aucune tournée aujourd'hui » · « Aucun prospect
  ne vous est assigné pour l'instant. Votre tournée s'affichera ici dès qu'un
  admin vous en assigne. » The next sync that brings an assignment shows the
  start screen in its place.
- **Never loaded** (`WifiOff`): no pull has ever succeeded on this phone.
  « Tournée pas encore chargée » · « Connectez-vous à internet une fois pour
  récupérer votre tournée. Elle restera ensuite disponible hors ligne. » These
  two replace the old empty round, « Aucun prospect à visiter. Synchronisez pour
  récupérer votre liste. »

Neither shows the location dialog: it appears only when there is a tournée to
start.

**The start screen previews the day, it does not start it.** An overline with
the Brussels date in full (« Mercredi 14 octobre »), « Tournée du jour », the
stop count (« {20} arrêts », `today.remaining`), then « Les arrêts seront
numérotés au départ, du plus proche au plus loin. » The stops are what the swipe
would freeze now (R1: assigned open prospects, follow-ups due today or earlier,
field prospects still in the outbox), in one card of plain 52px rows: a small
neutral dot, the name, "type · address". No number, because numbers do not
exist before the swipe; no distance, no action, no swipe, nothing focusable.
Sorted by name, the first seven, then « et {13} autres arrêts » (« et 1 autre
arrêt »); seven or fewer show without that line.

**The swipe « Commencer la tournée ».** A track fixed above the safe area, the
screen's only action, where the tab bar will be: 64px tall, full radius,
`secondary` fill with a 1px `border` ring, and the label « Glisser pour
commencer la tournée » in bold `text-base`. A 56px gold thumb (`primary`,
`primary-edge` ring) with Lucide `ChevronsRight` sits at its left end.

- **The gesture starts like the stop row's** (`swipe.ts`): `lockAxis` decides
  the axis after `SWIPE_SLOP`, so a vertical start scrolls the preview and
  never moves the thumb. Its commit is the track's own, not `SWIPE_COMMIT`'s
  96px, which on a 358px track would start the day by accident: right only,
  the thumb follows the finger, clamped to the track, with a gold wash filling
  behind it, and released past three quarters of the track it commits (a
  track-relative pure function beside `swipe.ts`); short of that, it snaps
  back and starts nothing. Under
  `prefers-reduced-motion` the snap is instant.
- **It is a real button.** The track is one `<button type="button">` named
  « Commencer la tournée ». Enter, Space and a screen reader's activation (a
  `click` whose `detail` is 0) start the tournée at once, as a full swipe does.
  A pointer tap with no drag does not: it nudges the thumb 24px right and back,
  the hint to slide, because a tap is the accident the swipe exists to prevent
  (a started tournée cannot be undone that day). This leaves no single-tap way
  in for someone who cannot drag (WCAG 2.5.1); the owner accepted that gap on
  2026-10-14, and the keyboard path stays.
- **Before a position, it is disabled.** The thumb turns `card` with a `border`
  ring and a muted `MapPin`, the label reads « En attente de votre position »,
  and the button is `aria-disabled` rather than `disabled`, so a screen reader
  still finds it and hears why. In practice this state sits under the location
  dialog: the dialog only closes on a reading.
- **On commit** the phone numbers the stops nearest-next from the reading taken
  at the commit (see The location dialog), writes the tournée and its stops to
  the outbox and opens Tournée, with no toast: the numbered list is the
  confirmation. While the reading and the write run the thumb stays at the far
  end, the label reads « Démarrage… », and the button is
  `aria-disabled` and ignores any further drag, key or click, so one day cannot
  start twice. A failed write snaps the
  thumb back and shows, under the track, « Impossible de commencer la tournée
  sur cet appareil. Libérez de l'espace de stockage, puis réessayez. » (the
  visit form's storage error, same cause).

**The location dialog is an alert, over a day you can already see.** A shadcn
`AlertDialog` whose overlay also blurs (`backdrop-blur-sm`), so the date and the
stops read through it as the reason to go on. It has no cancel: Escape and the
overlay do nothing, and T1 has no way past it without a position. Its content,
top to bottom: a 48px gold disc with `MapPin`, the title « Activez la
localisation », the description « Afin de préparer votre tournée et démarrer
votre journée. » (what the position is for, never how it is used), a status
line, the full-width 48px « Activer », and the muted line « Ouvrez Réglages ›
Localisation, puis revenez ici. » The web app cannot open the phone's settings
(ADR-0036 › Context), so that line names them rather than linking.

« Activer » takes the same one-off reading as the old « Réessayer »
(`refresh()`), which brings up the browser's prompt the first time. When the
browser already reports the permission as granted, readings start as the dialog
opens, with no tap. While the dialog is open and the page is visible, the phone
repeats one-off readings (`getCurrentPosition`, never `watchPosition`) until one
is precise enough: the threshold (`LOCATION_GATE_ACCURACY_M`), the cadence
(`LOCATION_GATE_RETRY_MS`) and the fix's `enableHighAccuracy`
(`LOCATION_GATE_HIGH_ACCURACY`) are named constants in `location-gate.ts`, set
by the owner's pavement test. The status line (`role="status"`, polite) says where that stands:

| State | Status line |
|---|---|
| Before the first reading | absent |
| A reading outstanding | spinner, « Recherche de votre position… » (`today.locating`) |
| Too coarse, trying again | spinner, « Précision : {350} m. On affine… » |
| Refused | « La localisation est refusée sur ce téléphone. » |
| Unavailable or timed out | « Position introuvable. Sortez à découvert si possible, puis touchez Activer. » |

A reading that passes closes the dialog and moves focus to the swipe. The swipe
then takes one last fresh reading (`LOCATION_GATE_SWIPE_TIMEOUT_MS`) and numbers
the stops from it when it passes the same threshold, else from the reading that
passed; the track says « Démarrage… » for that wait and the dialog stays shut. A
phone that never gets one (no GPS indoors, a permission the browser will not
ask for again) stays here: T1 has no way past, and the agent calls the admin
(ADR-0036 › Consequences). After the swipe the location gate is over: a phone
that loses its position later in the day locks nothing.

### Next-stop card

*Built by entry 5 (numbers on the card, the rows and every saved stop leaving),
entry 6 (« Nouveau » and gaps) and entry 7 (the counter).* Mockup:
[`key-t2-tournee.png`](../_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-t2-tournee.png).

The stops are numbered once, at the swipe, and keep that number all day
([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md) ›
Numbers). The first stop still to do is not a row, it is an instruction, so it
gets a card: a gold 4px inset edge, its own `StopNumber` in `variant="next"`,
the name, "type · address", the distance, then "Y aller" and "Visiter", the same
pair a stop row reveals on tap. Every other stop is a `StopRow`, a quiet ledger
beneath the card.

```
┌──────────────────────────────────┐
│ ▮ Captain Prospectus        ● 0  │  band: mark, wordmark, sync state
├──────────────────────────────────┤
│ Tournée du jour                  │
│ 15 sur 20                        │  the counter: arrêts, never visites
│  ███████████████████████░░░░░░░  │
│                                  │
│▎ PROCHAIN ARRÊT                  │
│▎ (16) Le Kebab du Coin           │  lowest number with no visit today
│▎      Restauration rapide · …    │  gold 4px edge, gold disc
│▎                         120 m   │
│▎ ┌────────────┐ ┌────────────┐   │
│▎ │  Y aller   │ │  Visiter   │   │  48 px; « Visiter » is the gold one
│▎ └────────────┘ └────────────┘   │
│                                  │
│┃ (17) Friterie Saint-Gilles 210 m│  stop row, status edge, collapsed
│┃ (18) Food truck Flagey   340 m  │
│┃ (20) Pizza Vera          520 m  │  19 left unvisited: a gap, no row
│┃ (21) Chez Nour           610 m  │
│┃      [Nouveau]                  │  joined after the swipe: outline badge
├──────────────────────────────────┤
│  ⬤      ⬤       ⬤       ⬤        │  tab bar ("Tab bar" below)
│ Tournée Carte  Carnet  Ajouter   │
└──────────────────────────────────┘
```

**The counter reads « {n} sur {total} », in arrêts.** Under the title, `{n}` in
bold 28px and « sur {total} » in semibold 18px, both tabular, then the 8px bar:
`--secondary` track and gold fill, `progress.tsx`'s indicator carrying its
usual `primary-edge` inset (rule 4, "Every gold fill carries `primary-edge`",
above). Its accessible name is « {n} arrêts faits sur {total} » (singular « {n} arrêt fait sur {total} » when n ≤ 1). No percentage,
no ETA, and no other count on the screen: it replaces both « {n} arrêts » and
« {n} portes sur {total} aujourd'hui ». `n` and `total` are ADR-0036 › The
counter's, from the server's visits joined with the outbox, so the number
never exceeds the total, never resets on a cache wipe, and a second visit to a
stop leaves it where it was. Right after the swipe it reads « 0 sur {20} ».

**The numbers are the swipe's, and the list keeps them.** Two exceptions, both
a phone adopting the server's numbering after it lost a race, with no message.
First, when two phones of one agent both swipe offline, the earliest swipe by
the phones' start time wins, whichever syncs first, and the other phone takes
its numbers from the next pull (ADR-0036, amended 2026-10-17). Second, when
two phones of one agent append different joiners under the same number, the
server keeps the first stored, and the other phone re-appends its prospect as
the next number on its next pull (entry 6, owner decision of 2026-10-15): only a joiner not yet synced
can be renumbered. The card shows the
lowest-numbered stop with no visit today; the rows follow in number order.
Distances still show, from the latest reading, as information: they never
reorder anything. `StopNumber` is a 32px tabular disc with the stop's own
number, never a position in the list: gold on the card, `secondary` on a row.
The card and every row are named « Arrêt {n} · {name} » for a screen reader,
the same name a Carte pin carries. With no reading, the distances read
« Position inconnue » and nothing else changes: no notice, no other order. Each
screen still takes its one reading when it opens, which is the retry; there is
no « Réessayer » any more.

**A missing number is not a row to worry about.** Tournée lists only what is
left to do, so a number is missing either because the stop is done (it is in
Carnet, and counts in `n`) or because it left unvisited: reassigned, closed by
an admin, or merged. A stop that left drops out of `total` too, and nothing
renumbers: 18 is followed by 20. There is no placeholder row for either; Carnet
says which numbers were done.

**A stop that joins is « Nouveau ».** A prospect that joins the tournée after
the swipe takes the next number after the highest the tournée has ever given,
a stop that left included (21, 22…), so a number is never reused. A stop that
left and comes back (reassigned back the same day) keeps its first number and
is not « Nouveau »: it was in the tournée all along. A joiner carries
« Nouveau » under its meta line, where « Pas encore envoyé » sits, on its row,
on the card when it becomes the next stop, and in Carte's sheet, all day. The
badge is `outline` (a 1px `foreground` ring, no fill), never the `secondary`
fill of a status badge: `STATUS_LABELS.new` is also « Nouveau », and the shape
is what keeps a joiner from reading as a status.

**Every saved stop leaves Tournée, whatever its outcome.** The moment the visit
is in the outbox the stop moves to Carnet, before any sync, and the counter
rises if it was that stop's first visit today. This is placement read from the
outbox, never a status (invariants 2, 3). There is no "Plus tard" section and
no "end of today's round": a follow-up due on a later day comes back as a stop
in that day's tournée, and one due today is reopened from Carnet. « Pas encore
envoyé » (`warn`-tinted) therefore no longer marks a visited stop here; on
Tournée it marks only a joiner that is a field prospect still in
`outboxProspects`.

**All done.** When no stop is left to visit, the card's place holds a centred
card: a 56px `success`-tinted disc with a check, « Tous les arrêts sont
faits. », the muted « Retrouvez-les dans Carnet. » and a `secondary` button
« Ouvrir le carnet ». A tournée whose every stop left unvisited (`total` of 0)
reads « Plus aucun arrêt dans votre tournée aujourd'hui. » instead, with the
same button.

**The card carries the only actions that do not need a tap.** A stop row is
collapsed by default — number, name, "type · address", its badge when there is
one, and the distance, `min-h-16` with its own 4px status edge — and
tapping its header (`aria-expanded`, `aria-controls`) expands it in place to
the same "Y aller"/"Visiter" pair as the card, no navigation and nothing
written to Dexie. Opening one row closes whichever was already open: at most
one is expanded at a time. A swipe on the header is a second way in, not the
only one: a gesture decides its axis after 10px, and left starts Visiter,
right starts Y aller, once it commits past 96px — the row sliding to reveal a
96px panel underneath. A swipe that stays short of 96px, or one that decides
vertical, snaps back and starts nothing, and the tap it might otherwise also
fire is swallowed. Without coordinates, "Y aller" is absent, a right swipe
does not move the row, and "Visiter" takes the row's full width — on the card
too.

**The round carries no "Ajouter un prospect" button of its own.** The Ajouter
tab — bottom on a phone, inline in the band from 768px ("Tab bar" below) — is
the one way to add a place, so the screen does not duplicate it under the list.

**From 768px, the list sits left and the next stop right.** A `md:grid
md:grid-cols-5` splits the screen roughly 40/60: the list takes the first two
columns, the card the remaining three, `md:sticky` so it stays in view while
the list scrolls. When all stops are completed, the completion card spans the full width (`md:col-span-5`). The card is still first in the DOM — only its grid placement
moves it to the right — so a screen reader or a keyboard tab order meets it
before the list either way.

### Carte

*Its numbering is built by entry 5 of the numbered-tournée epic (#496).* Mockup:
[`key-t2-tournee.png`](../_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-t2-tournee.png), frame 2.

`/round/map`, the tab bar's second slot (spec-gh-121) — a lazy chunk, same
as the visit form and Ajouter, so an agent who never opens the map never
blocks the first paint on Leaflet loading; ADR-0026 still precaches the chunk
regardless, so it is already on the phone and Carte works the first time it is
opened offline. Built from the same tournée Tournée reads: the same stops, the
same numbers and the same next stop, though each screen takes its own
one-shot position reading (no screen reads another's; the latest reading is also
kept in module memory, for the next sync only, per ADR-0028), so the two are read
moments apart, not literally the same call.

Below 768px the map carries a selected stop in a persistent sheet; from 768px
the sheet is replaced by a list pane, the map's own left-hand twin
(spec-gh-122). `CarteScreen` renders one or the other by `useIsMobile()`,
never both — a duplicate "Visiter" link in the DOM is exactly the bug that
guard exists to rule out.

```
┌──────────────────────────────────┐
│ ▮ Captain Prospectus        ● 0  │
├──────────────────────────────────┤
│                                  │
│        (16)                      │  gold pin, the next stop, 34px
│          ╲                       │
│           (17)                   │  card pin, 28px, the stop's own number
│             ╲                    │
│              (18)──(20)          │  dashed 3px gold line, in number order;
│     ◉ (you)                      │  no 19: it left. Navy dot with a halo
│                                  │
│                        [ ⌖ ]     │  44px "Me recentrer", bottom right
│ © les contributeurs OpenStreetMap│
├──────────────────────────────────┤
│▔▔▔▔▔▔▔▔▔▔▔▔ (handle) ▔▔▔▔▔▔▔▔▔▔▔▔│  the sheet: rounded top, 12px over the map
│ (16) Le Kebab du Coin    120 m   │
│      Restauration rapide · …     │
│ ┌────────────┐ ┌────────────┐   │
│ │  Y aller   │ │  Visiter   │   │
│ └────────────┘ └────────────┘   │
├──────────────────────────────────┤
│  ⬤      ⬤       ⬤       ⬤        │  tab bar: Tournée, Carte, Carnet, Ajouter
└──────────────────────────────────┘
```

**Pins carry the swipe's numbers, never a second order.** A pin is drawn for
each stop still on Tournée, with that stop's own number: the next stop (the
lowest number with no visit today) in gold, `card` for the rest, both
`L.divIcon` so their size and colour are Tailwind classes rather than an image
asset. A visited stop has moved to Carnet and draws no pin; a stop that left
draws none either, so the map has the list's gaps. A stop with no coordinates
draws no pin but keeps its number and its row on Tournée, so a pin can be
missing that the list still shows. Every pin is keyboard-reachable and named
"Arrêt {n} · {name}" (`copy.carte.pinLabel`); tapping or activating one selects
that stop — the sheet or the list pane's own expanded row follows it — without
ever repainting the pin itself: selected state changes nothing about colour,
so gold still means only "the next stop".

**The sheet is a plain panel, never shadcn `Sheet`.** `Sheet` is a Radix
dialog: it traps focus, dims the screen and closes on any outside pointer —
including a pin tap, the one interaction meant to update this panel rather
than dismiss it. A persistent panel that never opens or closes is a
`<section>`, in flow below the map rather than laid over it (a 12px negative
margin overlaps its rounded top corners with the map above), so the
attribution line and "Me recentrer" — drawn inside the map's own, now shorter,
box — are never measured against the sheet's height to stay clear of it. It
shows the selected stop's number (gold only when it is the next stop), name,
"type · address", the "Pas encore envoyé" badge, the distance, then "Y aller"
and "Visiter" — the same row `StopRow` and `NextStopCard` already draw, so a
stop never reads differently on the two screens, « Nouveau » included. With
no stop left it shows « Tous les arrêts sont faits. Retrouvez-les dans
Carnet. » instead (or « Plus aucun arrêt dans votre tournée aujourd'hui. » when `total` is 0), no actions. Selection is resolved every render — the tapped
stop's id, falling back to the next stop the moment it leaves Tournée (saved,
so moved to Carnet, or left the tournée) — never reset by an effect of its own.

**From 768px, a list pane replaces the sheet, the map's own left-hand twin.**
`NextStopCard` for the next stop, then a `StopRow` per remaining stop, in
number order, exactly as Tournée lists them. Tapping a pin expands that stop's row (closing any
other) and scrolls it into view; a tap on the next stop's pin scrolls to the
card instead, which is always open. Tapping a row's own header toggles it
exactly as it does on Tournée.

**The path joins the stops in number order, not the agent.** A straight segment from wherever
the agent happens to be would look like a route, and ADR-0002 rules out a
routing service that could draw a real one. It is the one place colour comes
from `readToken` (`MapCanvas`'s own pattern) rather than a Tailwind class:
Leaflet's vector layers take a CSS colour string, not a class. The attribution
is Leaflet's own control, fed `copy.attribution` (INVARIANT 11) — never a
second line drawn by hand, which is the one way it could get laid out away.

**Offline, the map is not mounted at all.** Leaflet requests a tile on every
pan, so the only way to guarantee no request leaves the phone is to never
create the map in the first place. A `bg-secondary` canvas and a card stand in
instead — "Carte indisponible hors ligne. La liste reste à jour.", and "Voir
la liste" back to Tournée — while the sheet (phone) or the list (tablet) keeps
showing the round exactly as it does online, since neither reads anything the
map itself provides. After the swipe the order is fixed, so a refused or lost
position changes no pin and no number, and there is no notice: the distances
read « Position inconnue », the agent's dot is absent, and « Me recentrer » is
the way to ask again.

**Re-centre asks `useAgentPosition` for a reading — up to two minutes old**
(its `maximumAge`), **never a continuous track** (no `watchPosition`, by
design), and pans there once it lands; without one, it fits the view back to
the pins instead of looking like it did nothing. The control is a 44px `card`
square — DESIGN.md's one sanctioned exception below the field's usual 48px,
because it floats over the map rather than sitting in the thumb's normal row.

**The map re-lays out on its own pane's size, not just the viewport's.** A
phone rotating, or the sheet's height changing, resizes the map's container
with no prop of the map's own changing at all, so a `ResizeObserver` calls
Leaflet's `invalidateSize()` directly rather than waiting on a redraw that may
never come.

### Carnet

*Built by entry 8 of the numbered-tournée epic (#496, shipped in #504).* Mockup:
[`key-t3-carnet.png`](../_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-t3-carnet.png),
frames 1, 2 and 4.

`/round/logbook`, the tab bar's third slot: what the agent did today, the
page of the *carnet de tournée* they used to keep in a pocket. Tournée is what
is left; Carnet is what is done. It lists today's door-days (one prospect, one
Brussels day, its latest visit), from the server's visited stops joined with
the outbox, so a cache wipe or a second phone shows the same page after a sync
([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md) ›
Placement and Carnet).

```
┌──────────────────────────────────┐
│ ▮ Captain Prospectus        ● 1  │
├──────────────────────────────────┤
│ 1 élément en attente d'envoi     │
├──────────────────────────────────┤
│ MERCREDI 14 OCTOBRE              │
│ Carnet                           │
│ ┌──────────────────────────────┐ │
│ │(15) Le Comptoir      15:42 › │ │  newest first
│ │     Bar · Rue du Midi 8      │ │
│ │     [Converti] [Pas encore   │ │  neutral outcome badge; outbox badge
│ │     envoyé]                  │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │(14) Pizza Roma       15:10 › │ │
│ │     Restaurant · Rue Neuve 4 │ │
│ │     [Converti]  2 visites    │ │  reopened today
│ └──────────────────────────────┘ │
├──────────────────────────────────┤
│  ⬤      ⬤       ⬤       ⬤        │
│ Tournée Carte  Carnet  Ajouter   │
└──────────────────────────────────┘
```

**A row is one stop and its latest outcome.** Newest first, by the latest
visit's time. Each row is a card like a stop row, `min-h-16`: the stop's
`StopNumber` (`secondary`, never gold: nothing here is next), the name, "type ·
address", then a line of badges, and the time of the latest visit (« 15:42 »,
tabular) with a `ChevronRight` on the right. The latest outcome is a neutral
badge (`secondary` fill, `foreground` text) with its French label, the save
summary's badge, and the row has no status edge. On the phone an outcome never
takes a status colour: that would preview the status the server derives
(invariant 3, EXPERIENCE.md › Rejected on principle), the reason the visit
form's history shows the outcome as plain text. « Pas encore envoyé » (`warn`)
follows while a visit of the day sits in the outbox, and the muted
« {2} visites » when the stop was visited more than once today. A closed
prospect (Converti, Intéressé, Pas intéressé) stays listed: the sync carries
today's visited stops whatever their status. The header is the date and « Carnet »; there is no
count here, because the counter lives on Tournée and a second one would
disagree with it the moment a door-day falls outside the tournée (below).

**Tapping a row reopens the stop.** The whole row is one link, named
« Arrêt {n} · {name} · {outcome}, à {15:42}. Rouvrir » (or « {name} · {outcome}, à {15:42}. Rouvrir » without a stop number when unnumbered), to the visit form for
that prospect. It is the only way to visit a stop again, and saving there adds
a **new visit** (ADR-0007): the row moves to the top with the new outcome and
« 2 visites », and the counter does not move. Step 1's back link reads
« Retour au carnet » and a save returns to Carnet, since that is where the
visit was opened from; « Visite enregistrée… » shows there as it does on
Tournée. No swipe on these rows: there is one action, so a tap is enough.

**A door-day outside the tournée has no number.** A visit saved after midnight
belongs to the new day; if its prospect is not in that day's tournée (it closed
with that very visit, say), its row shows an empty `StopNumber` ring with a dash
instead of a number, and it never counts in « {n} sur {total} » (owner's
decision, 2026-10-14). Everything else about the row is the same.

**Empty**, Carnet is an invitation like every other empty screen: a card with a
56px `secondary` disc and the `NotebookPen` icon, « Aucun arrêt fait
aujourd'hui. » and the muted « Chaque arrêt enregistré arrive ici, avec son
résultat. » No button: the next stop is one tab away.

**Today only.** Yesterday's page is gone at midnight, from the phone and from
the screen alike. History lives where it always has: in the visit form's
« Visites précédentes », and on the admin side.

### Midnight

*Built by entry 9 of the numbered-tournée epic (#496, shipped in #505).* Mockup:
[`key-t3-carnet.png`](../_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-t3-carnet.png),
frames 3 and 4.

At Brussels midnight the day is over and the gates come back
([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md) › The
gates). What the agent sees depends on where they are:

- **On Tournée, Carte or Carnet:** the screen gives way to the new day's first
  gate, with no message of its own: the date on the start screen
  (« Jeudi 15 octobre ») and the location dialog say it. The tab bar goes, as
  before any swipe. Yesterday's numbers and Carnet page go with it.
- **In an open visit form (or its save summary):** nothing moves under the
  agent's thumb. The form stays, and « Enregistrer » saves to the outbox as
  usual; only then does the start screen show, under the location dialog. The
  dialog itself opens with « Visite enregistrée. Elle partira à la prochaine
  synchronisation. » above its title, once, so the agent reads that the visit
  is safe before anything else.
  The visit's time is when « Enregistrer » was tapped, so a visit saved at 00:01
  is a door-day of the new day (Carnet's numberless row, above). Leaving the
  form without saving asks first, through the same leave guard as a tab tap
  (#74), and then lands on the start screen.
- **On Ajouter:** the same as the visit form, except that « Ajouter » writes
  only the place and no stop, since the new day has no tournée yet; as a field
  prospect still in the outbox, it is in the new day's snapshot at the swipe.

The sync goes on through midnight: the dot, the strip and their buttons never
wait for a swipe.

### One decision per screen

The today list asks *which door*. The visit form asks *what happened*. Nothing
else is allowed to compete.

```
┌──────────────────────────────────┐
│ ←  Retour à la tournée           │
│ Le Bouchon des Filles            │
├──────────────────────────────────┤
│  ┌────────────────────────────┐  │
│  │ [x] Flyer remis            │  │  a card, not a bare row
│  │     Cochez si vous avez    │  │
│  │     laissé un flyer sur    │  │
│  │     place.                 │  │
│  └────────────────────────────┘  │
├──────────────────────────────────┤
│  Résultat                        │
│  ┌────────────────────────────┐  │
│  │ [ic] Personne sur place ( )│  │  icon tile · label · hint · disc
│  │     Fermé ou personne pour │  │
│  │     répondre. On repassera.│  │
│  ├────────────────────────────┤  │
│  │ [ic] Intéressé          (x)│  │  ← gold: chosen, never a status
│  │     Ouvert à la discussion,│  │
│  │     pas encore inscrit sur │  │
│  │     la liste d'attente.    │  │
│  ├────────────────────────────┤  │
│  │ [ic] Pas intéressé      ( )│  │
│  │     Refus clair.           │  │
│  ├────────────────────────────┤  │
│  │ [ic] À relancer         ( )│  │
│  │     Un rendez-vous à       │  │
│  │     reprendre.             │  │
│  ├────────────────────────────┤  │
│  │ [ic] Converti           ( )│  │
│  │     Déjà inscrit sur la    │  │
│  │     liste d'attente.       │  │
│  └────────────────────────────┘  │
│                                  │
│  Quand ?                         │  only for À relancer / Personne sur place
│  ( ) Aujourd'hui  ( ) Choisir…   │  when-step.md; date shown once chosen
│                                  │
│  Notes                           │
│  ┌────────────────────────────┐  │
│  └────────────────────────────┘  │
│                                  │
│  Visites précédentes             │
│  12 sept.            Intéressé   │
├──────────────────────────────────┤
│  [   Enregistrer la visite   ]   │  sticky above the tab bar (GH #66)
└──────────────────────────────────┘
```

The outcome list takes an unreasonable share of the screen on purpose. It is the
one thing the whole app exists to capture, and it has to be hittable by a thumb
without the agent looking carefully. Five stacked full-width cards, `min-h-
decision` each, not a select and not a grid of chips.

**Every card is the same neutral colour, chosen or not (INVARIANT 3).** A 40px
`bg-secondary` icon tile — `DoorClosed`, `ThumbsUp`, `ThumbsDown`, `Clock`,
`BadgeCheck` — sits left of the label and a one-line hint, with a 24px disc on
the right. The five icons and the five hints are the only thing that tells one
card from another; nothing about their colour does. Picking a card turns its
tile and disc gold, adds a check, and washes the card at 12% gold with a
gold-edge border — DESIGN.md's `outcome-card-selected` component token,
implemented here with `has-[:checked]:` utilities rather than a class of its
own. That is *selection*, the same gold that marks the current tab or sidebar
item, never a preview of the status `OUTCOME_TO_STATUS` would derive from the
outcome.

**A hint describes what the agent saw or heard, never what it does to the
prospect.** "Refus clair.", not "passe en Refusé" — the mapping to a status is
the server's alone, and a client that previews it is a client that can disagree
with it. The new status arrives on the next sync, in the list.

**Flyer remis is a card too, not a bare checkbox row**, so it reads at the same
weight as the decision beneath it: a checked square, the label, and a hint
underneath saying what to check it for.

**A blocked "Continuer" (or, with no script, "Enregistrer la visite") moves the
screen to the decision.** "Choisissez un résultat." appears under Résultat as a
`role="alert"`, and focus moves to the first outcome card's own radio,
scrolled to the centre of the screen — the message says why, the focus says
where, and a thumb that was already near the outcome list never has to hunt for
either.

### The script is the second screen

M3 puts the active script's questions in the visit form. Principle 6 decides the
shape before anything else does: *if a screen asks two questions, it is two
screens.* The outcome is what the app exists to capture and nothing may compete
with it, so the questions do not join it — they follow it.

```
     step 1                             step 2
┌──────────────────────────────────┐ ┌──────────────────────────────────┐
│ ←  Retour à la tournée           │ │ ←  Résultat                      │
│ ●  Étape 1 sur 2 · Résultat      │ │ ●  Étape 2 sur 2 · Questions     │
│ Le Bouchon des Filles            │ │ Le Bouchon des Filles            │
├──────────────────────────────────┤ ├──────────────────────────────────┤
│ [x] Flyer remis                  │ │  Questions                       │
├──────────────────────────────────┤ │                                  │
│  Résultat                        │ │  Proposez-vous la livraison ?    │
│  ┌────────────────────────────┐  │ │  ┌───────────┐┌───────────┐      │
│  │ [ic] Personne sur place ( )│  │ │  │    Oui    ││    Non    │      │
│  ├────────────────────────────┤  │ │  └───────────┘└───────────┘      │
│  │ [ic] Intéressé          (x)│  │ │                                  │
│  ├────────────────────────────┤  │ │  Quelle caisse utilisez-vous ?   │
│  │ [ic] Pas intéressé      ( )│  │ │  ┌────────────────────────────┐  │
│  ├────────────────────────────┤  │ │  │ Aucune                     │  │
│  │ [ic] À relancer         ( )│  │ │  ├────────────────────────────┤  │
│  ├────────────────────────────┤  │ │  │ Papier                     │  │
│  │ [ic] Converti           ( )│  │ │  └────────────────────────────┘  │
│  └────────────────────────────┘  │ │                                  │
│                                  │ │  Satisfaction ?                  │
├──────────────────────────────────┤ │  ┌──┐┌──┐┌──┐┌──┐┌──┐            │
│  [        Continuer          ]   │ │  │1 ││2 ││3 ││4 ││5 │            │
└──────────────────────────────────┘ │  └──┘└──┘└──┘└──┘└──┘            │
                                     │                                  │
                                     │  Combien de places ?             │
                                     │  ( − )   [    3    ]   ( + )     │
                                     │                                  │
                                     │  Quand ?                         │
                                     │  ( ) Aujourd'hui  ( ) Choisir…   │
                                     │                                  │
                                     │  Notes                           │
                                     │  ┌────────────────────────────┐  │
                                     │  └────────────────────────────┘  │
                                     ├──────────────────────────────────┤
                                     │  [   Enregistrer la visite   ]   │
                                     └──────────────────────────────────┘
```

**The step indicator names where you stand, not just where the button goes.**
This reverses an earlier call here — "no 1 sur 2, no dots, no progress bar" —
because DESIGN.md's redesign (› Step indicator) asks for one, echoed in
EXPERIENCE.md › Step indicator: an action's own name is not enough to say
*which* step an agent is on. A `size-1.5` gold dot leads a `text-overline` line
reading « Étape 1 sur 2 · Résultat » or « Étape 2 sur 2 · Questions » (« Étape 2
sur 2 · Quand ? » for À relancer and Personne sur place, whose step 2 is the
when step alone, GH #239, GH #244), on both steps, and it is absent only when the visit has one step to begin with — a
script with nothing this build can render must never make the one-step path
read "1 sur 2". An action still keeps its own name through the flow, so «
Enregistrer la visite » still appears exactly once, on the screen that
actually saves, and step 1 still offers « Continuer » — the indicator says
*which* step, the button still says *what happens next*.

**The back link names its destination rather than pointing vaguely backwards.**
On step 2 it reads « Résultat », not « Retour à la tournée »: it returns to step
1 with the draft intact. Leaving the visit entirely is still possible from there,
one step further out. Nothing an agent has typed is ever one stray tap from
being lost.

**Every choice on step 2 is a tile, not a disc.** DESIGN.md › Choice controls
(field): yes/no is two equal tiles, single-choice is full-width rows, and the
1–5 rating is five equal tiles, all unselected on `{colors.card}` with a
border. Picking one fills it gold with navy text and the `primary-edge`
border — `components.choice-selected` — over a native, visually hidden radio,
so the fill itself is what marks the pick and arrow keys still move between
options. Questions are not wrapped in a card of their own: the tiles already
read as the "questions as cards" EXPERIENCE.md asks for, and a card around
them would flatten that.

**The number stepper never goes below zero.** A typeable value in display
weight sits between two 48px secondary buttons, "−" and "+" ("Diminuer" /
"Augmenter"). "−" disables itself once the value is already 0 or empty, typing
a negative number clamps to 0 on the way in, and clearing the field is no
answer at all — not zero, which is an answer and a different thing.

**Step 2 exists only when there is something to ask.** No cached script, or a
script whose questions this build cannot render, and the form is one screen
with Notes inline, « Enregistrer la visite ». A missing questionnaire must
never stand between an agent and a saved visit, and it must not cost a tap
either.

**`no_contact` and `follow_up` still get step 2, but the script's questions
are gone.** Nobody able to answer may have been at the door — closed, or the
boss busy or away — so `field-operations.md` never asks them rather than asking
and waiving each one: the questions are not rendered, and no answer rides along
unseen (GH #244). An agent made to answer anyway would invent the answers. What
replaces them is the when step (GH #239,
`_bmad-output/specs/spec-done-stop-leaves-the-round/when-step.md`): "Aujourd'hui"
or "Choisir une date", opened on "Aujourd'hui" for Personne sur place, which can
only lack a choice by bug, and on nothing for À relancer.
The notes still live on this screen, and "ferme le lundi" written off a sign in
the window is the most valuable thing an agent can record about a door nobody
answered.

**Pas intéressé always gets step 2, and asks for a reason instead of the
script — the one exception to "step 2 exists only when there is something to
ask" above.** A restaurateur who says no won't answer a whole questionnaire,
but one tapped reason is the only record of why (`prospecting.md#refusal-
reasons`, GH #248). Step 1 reads « Continuer » for this outcome even with no
cached script, and step 2's indicator reads « Étape 2 sur 2 · Raison du
refus »:

```
     step 1                             step 2
┌──────────────────────────────────┐ ┌───────────────────────────────────┐
│ ←  Retour à la tournée           │ │ ←  Résultat                       │
│ ●  Étape 1 sur 2 · Résultat      │ │ ●  Étape 2 sur 2 · Raison du refus│
│ Le Bouchon des Filles            │ │ Le Bouchon des Filles             │
├──────────────────────────────────┤ ├───────────────────────────────────┤
│ [x] Flyer remis                  │ │  Raison du refus                  │
├──────────────────────────────────┤ │  ( ) Trop d'applis / de tablettes │
│  Résultat                        │ │  ( ) Attend de voir…              │
│  ┌────────────────────────────┐  │ │  ( ) Méfiance sur les frais       │
│  │ [ic] Pas intéressé      (x)│  │ │  ( ) Pas besoin, ça marche…       │
│  └────────────────────────────┘  │ │  ( ) Hors cible / fermé           │
│                                  │ │  ( ) Refus sans raison            │
├──────────────────────────────────┤ │  ( ) Autre                        │
│  [        Continuer          ]   │ │                                   │
└──────────────────────────────────┘ │  Notes                            │
                                     │  ┌────────────────────────────┐   │
                                     │  └────────────────────────────┘   │
                                     ├───────────────────────────────────┤
                                     │  [   Enregistrer la visite   ]    │
                                     └───────────────────────────────────┘
```

The radios are native (ADR-0015, ADR-0026), in `REFUSAL_REASONS`'s order.
"Autre" also requires a note — the only combination that needs one — checked
the same way a missing reason is, on save. The save summary gains a
« Raison du refus » row with the chosen label, shown only for this outcome.

**A blocked save moves the screen to the problem.** With a variable number of
questions, the first invalid one can easily sit below the fold, and a button that
appears to do nothing is how a form gets abandoned on a pavement. Saving with an
invalid answer scrolls that question into view and focuses it, as well as marking
it. This is the same trap `withOutcome` exists to dodge, one screen along.

### Saving asks once

```
  phone (< 768px): bottom sheet
┌──────────────────────────────────┐
│              ────                │  handle, decorative
│  VALIDATION                      │
│  Enregistrer cette visite ?      │
│ ┌──────────────────────────────┐ │
│ │ Établissement   Curry House  │ │  on secondary
│ │ Résultat        (Intéressé)  │ │  neutral badge
│ │ Flyer         (✓ Flyer remis)│ │  only when ticked
│ │ Questions         4 réponses │ │  only with a script
│ │ Notes                        │ │  only when typed
│ │ Repasser jeudi.              │ │
│ └──────────────────────────────┘ │
│  ☁ La visite reste sur ce        │
│    téléphone jusqu'à la          │
│    prochaine synchronisation.    │
│  [        Enregistrer        ]   │
│  [ ✎        Modifier         ]   │
└──────────────────────────────────┘
```

« Enregistrer la visite » validates exactly as before, and a blocked save still
moves the screen to the problem. A valid draft no longer queues at once: it
opens a summary, and only that summary's « Enregistrer » writes the outbox row,
through the same `queueVisit` the counter reads. The agent is back on Tournée
du jour with « Visite enregistrée… »: the stop has moved to Carnet, the next
stop is on the card, and the counter has risen by one on a stop's first visit
today (a visit reopened from Carnet returns to Carnet instead, and moves no
count). From 768px the same content is a centred Dialog, with « Modifier » and «
Enregistrer » side by side, Enregistrer on the right.

**Why a visit asks at all.** A visit is append-only (INVARIANT 2): once it syncs,
the agent cannot take it back. The summary is the last look before that, on a
pavement, at the one moment a wrong outcome tap is cheap to catch. It costs one
tap, and it never waits on the network: the reassurance line says the visit
stays on the phone until the next sync.

**The summary names, it never previews.** The outcome is a neutral badge,
never an `outcome-*` colour and never the status it leads to (INVARIANT 3). A
row that does not apply is absent rather than "Non": no flyer row when none was
left, no Notes row when none were typed, and no Questions row on a visit with no
script. With a script, the row counts only what was answered — a cleared text
or an unticked multi-choice is not an answer — so À relancer and Personne sur place,
which send no answers, read « 0 réponse ».

**« Modifier » loses nothing.** It closes the summary and puts focus back on «
Enregistrer la visite ». The form was never unmounted, so every answer, the
note and step 1's choices are still there. Escape and the scrim do the same.
While the write runs, both buttons are disabled and « Enregistrer » reads «
Enregistrement… », so a second tap cannot queue the visit twice. If the write
fails, the summary stays open with the storage error, and « Enregistrer » can
be tapped again (INVARIANT 5).

### From 768px, the form sits left, history and map right

```
┌───────────────────────────┬──────────────────────┐
│ ← Retour à la tournée     │ Visites précédentes  │  sticky pane,
│ Étape 1 sur 2 · Résultat  │ 12 sept.   Intéressé │  both steps
│ Le Bouchon des Filles     │ ┌──────────────────┐ │
│ [x] Flyer remis           │ │     (2)  ●       │ │  the place's own pin,
│ Résultat …                │ │   © OpenStreetMap│ │  as Carte numbers it
│ [      Continuer       ]  │ └──────────────────┘ │
└───────────────────────────┴──────────────────────┘
```

The form takes three of five columns, the pane two (spec-gh-126). The pane is
context, not a question, so it stays beside step 2 as well: the agent can
read the last note while answering. Below 768px nothing changes — the history
sits under step 1 and there is no map. `VisitHistory` renders in exactly one of
those two slots, never both. The action bar sticks to the bottom of the form's
own column rather than spanning the viewport under the pane.

**The map is Carte's `RoundMap`, loaded lazily.** The pane only mounts from
768px, and it imports `RoundMap` with `React.lazy`, so a phone never fetches
or parses Leaflet for a visit. The chunk is the one Carte uses, still
precached (ADR-0026). The pin is the place's own pin, exactly as Carte draws
it: its swipe number, gold only when it is the next stop. Its pin selects
nothing and there is no path, since one place is not a route; the re-centre
control and the agent's dot stay, as on Carte. The map is absent, with
no notice, when there is no network (Leaflet requests a tile on every pan,
Carte's own reason), when the place has no coordinates, or when it is not in
today's tournée.

### Adding a place

```
│  Nom                             │
│  [ Le nom sur la devanture     ] │
│  Indiquez le nom de l'établis…   │  after « Ajouter » with Nom empty
│                                  │
│  Type                            │
│  [ Restaurant ] [ Restauration ] │  2 columns, 6 choice tiles
│  [ Café       ] [ Bar          ] │
│  [ Food truck ] [ Autre        ] │
│                                  │
│  Position                        │
│  ┌─────────────────────────────┐ │
│  │ (o) 50,8466 · 4,3528        │ │  « Utiliser ma position »
│  │               [Actualiser]  │ │  until there is a reading
│  └─────────────────────────────┘ │
│  Adresse (facultatif)            │
│  [                             ] │
│  Téléphone (facultatif)          │
│  [                             ] │
│  [          Ajouter           ]  │  sticky, above the tab bar
```

**Type is six choice tiles in two columns.** They are DESIGN.md's Choice
controls (field) over native radios (ADR-0015), so arrow keys move the pick
and the group announces as one control. Restaurant is checked on open; only
the checked tile is gold.

**Position is a card, not a map.** The agent is often offline here, and a map
without tiles would show nothing the coordinates don't. The card reads the
same in both cases, makes no tile request, and costs no Leaflet on this
screen. Coordinates use fr-FR with four decimals, about a shopfront. The
reading shown is always the one « Ajouter » would save; while a new one is
on its way, « Recherche de votre position… » shows under it.

**The position is read on open.** field-operations.md says a field
prospect's position defaults to where the agent stands, so the new place has a
pin and a distance even when nobody taps anything.
So the button reads « Utiliser ma position » only while there is no reading
(refused, unavailable, or still locating, when it is disabled), and
« Actualiser » once there is one. A place with no position is still added.

**« Ajouter » puts the place on the tournée at once** (entry 6). It writes one
`outboxProspects` row and the place's stop, then returns to Tournée du jour
with « Prospect ajouté… ». Added after the swipe, the place is a joiner: it
takes the next number at the end of the list and carries « Nouveau », with
« Pas encore envoyé » until the sync takes it, whatever its distance. A failed
write stays on the form with the storage error, like the visit form.

### Sync is ambient, never a toast

An agent's sync state is a **condition, not an event**. "Three visits waiting to
send" stays true for as long as there is no signal — sometimes hours. A toast
shows it for four seconds and then lies by omission.

So sync lives in two permanent places, both drawn from one pure function
(`syncView`, `src/client/field/sync-view.ts`) that decides all seven states in
one place rather than letting the band and the strip each branch on their own:

- **A dot and a count in the band**, always visible, on every field screen. The
  count pill (28px, `band-accent`, full radius) shows whenever something is
  pending, in every state below. The dot always carries its own accessible
  name too — synced included — because it sits on `role="img"`, not on a
  wrapper a screen reader would skip.
- **A strip under the band** that appears only when there is something to say.
  When nothing is pending and the last sync succeeded, there is no strip at
  all — the quiet state is silence, not an empty banner.

| State | Dot | Strip | Message | Button |
|---|---|---|---|---|
| Synced | `success`, no count | none | — | — |
| Waiting to send | `warn` + count | `band-strip` (the band, one step darker) | `copy.sync.pending` | — |
| Syncing | pulsing `band-muted`, with a halo | none, unless also waiting | as waiting | — |
| Offline | `warn` + count | `secondary` | `copy.sync.offline` | — |
| Failed | `warn` + count | `secondary` | `copy.sync.failed` | — |
| Session expired | `destructive` + count | `destructive`, `on-destructive` text | `copy.sync.authExpired` | Se reconnecter (opens `/login`) |
| Update needed | `warn` + count | `warn`, `on-destructive` text | `copy.sync.upgrade` | Mettre à jour |

Only two states carry a button, because only two ask the agent for something
the app cannot do by itself:

- **Se reconnecter** opens `/login` by router navigation, through the leave
  guard like the other strip buttons (a dirty form asks first); `/login` is part
  of the shell, so it needs no network. A 401 and a 403 at sync both show it
  (a 403 only comes from the cross-origin check); a redirect comes back opaque
  and shows the failed strip, never this one. The outbox is never touched: a
  session expiring is not a reason to lose a visit (INVARIANT 5).
- **Mettre à jour** takes a build already waiting, or reloads if the browser
  has not noticed one yet — either way the *next* sync's 426 can call
  `applyUpdateNow` again from a fresh page load. The shared `UpdatePrompt`
  Alert says the same fact, so it is hidden while this strip shows it
  (`hidesUpdateBanner`).

Offline and failed retry on their own, so a button there would ask the agent to
do what is already happening. Session expired and update needed keep their
strip and button while a retry runs in the background — `syncView` only lets
`running` make the dot pulse for those two, never drop the button or swap the
message, because `nextDelayMs` (`sync-schedule.ts`) keeps retrying both on
backoff and a button that disappears on every attempt is worse than a static
one.

The strip sits in two always-mounted live regions, one `aria-live="polite"`
and one `"assertive"`, rather than one region that toggles the attribute — a
screen reader that has never seen a region announce anything can miss its
first change, and "your session just expired" is exactly the message that
must land. Session expired and update needed use the assertive region; every
other state uses the polite one. Colour is never the only signal either way:
every dot and strip pairs its colour with a count, an icon or a French
sentence.

This is a deliberate departure from the roadmap's "a shadcn `sonner` toast on
failure". A toast is the wrong medium for a persistent condition, and it costs
~5 kB gzipped the field route does not have (ADR-0015). `sonner` stays on the
admin side, where the events it reports really are events.

### Tab bar

One component, two layouts, not two (GH #66): below 768px a bar fixed to the
bottom of the screen, 64px plus `safe-area-bottom`, `card` fill with a 1px top
border; from 768px the same tabs sit inline in the band's own row instead,
where the old band nav lived, and carry the band palette rather than the
card's. `position: fixed` ignores where an element sits in the DOM, so the
tabs live once, in the header markup, and only their classes switch at the
breakpoint — building two components would let the tab list and the current
tab's rule drift apart.

```
┌──────────────────────────────────┐
│ ⬤ Tournée ⬤ Carte ⬤ Carnet ⬤ Ajouter   │  ← 768px: inline in the band
├──────────────────────────────────┤
│                                  │
│          (the tournée)           │
│                                  │
├──────────────────────────────────┤
│  ⬤       ⬤       ⬤       ⬤       │  < 768px: fixed at the bottom
│ Tournée  Carte  Carnet  Ajouter  │
└──────────────────────────────────┘
```

Each tab is a 24px Lucide icon over a `text-meta` label, at least 48px in
every dimension the thumb can miss. Below 768px the current tab carries a gold
pill behind its icon alone (`primary` fill, `primary-edge` inset ring) and its
label goes bold `foreground`; an inactive tab is plain `muted-foreground`.
From 768px the pill spans the whole row's width instead, as a 36px (`h-9`)
inset pill centred in the band rather than its full 56px height (the 48px
touch minimum, `--spacing-touch`, applies below 768px only) — gold fill,
`primary-edge` inset ring, `primary-foreground` (navy) icon and label — reading
like the current item in the admin sidebar; an inactive tab there stays
`band-foreground` in every state, with a `band-accent` hover, and is never
`band-muted` — same rule as the sidebar's own item text (Layout, above):
`band-muted` is for group labels only.

**A screen's own action bar sits directly above the tab bar, never under
it.** Below 768px the tab bar is the field's bottommost fixed element and
owns `.safe-bottom` there; `VisitScreen`'s and `AddProspectScreen`'s own
sticky "Enregistrer"/"Ajouter" bar is offset up by the tab bar's height
(`.above-tab-bar`, `app.css`) rather than sharing its `bottom: 0` — two fixed
elements at the same coordinates only differ by which one *paints* on top,
and DOM order here would have hidden the save button under the tab bar, not
the other way round. From 768px there is no tab bar underneath, so the action
bar returns to `bottom: 0` and carries its own `.safe-bottom`-equivalent
inset again — on the visit, as a bar sticky in the form's own column (see
"From 768px, the form sits left"). Scrolling content clears whichever bars sit below it —
`.pb-tab-bar` for a screen with no action bar of its own, `.pb-action-bar` for
one that has one — both `calc()`'d off `--spacing-tab-bar-height` and the
safe-area inset rather than a guessed pixel figure.

**Four tabs** (Carnet's slot shipped with entry 8, #504; the
dashboard tab went with GH #561). Tournée, Carte, Carnet and Ajouter, in the
order of the day (what is left, where it is, what is done, and the odd one
out). Four tabs at 390px are about 97px each, well above the 48px minimum, and
the labels stay whole. The tab bar exists only after the swipe ("Before the
swipe", above). The field side is agent-only (ADR-0037), so no tab or card row
leads to the dashboard.

**A tab tap never silently discards a draft (#74).** `/round`'s own rule
differs from every other tab's — it is an index route, so it must match only
itself, or the admin sidebar's "path, or anything under it" rule would light
it up on `/round/new` and on an open visit too (`isCurrentTab`,
`tabs.ts`). Tapping a tab away from a dirty visit or add-prospect form — one
react-hook-form `formState.isDirty` the open screen registers, read at the
moment of the tap — opens a shadcn AlertDialog, "Quitter sans enregistrer ?",
and leaves only on "Quitter". "Annuler" leaves the draft exactly as it was,
values and focus both. Tapping the tab that is already current never asks and
never navigates. A save's own `navigate("/round")` bypasses the guard
entirely — it is built on the tab bar's own click handler, not on the router,
so a save is never the thing a dialog interrupts.

The same dialog guards two other buttons that also unmount an open form: the
sync strip's "Se reconnecter" and "Mettre à jour", and the field update
banner's "Mettre à jour" (spec-gh-74). All three run their action through
`LeaveGuardProvider`'s `leave(proceed)` instead of navigating or reloading
directly, so the tab bar, the strip and the banner cannot drift into asking
differently or not asking at all. "Se reconnecter" opens `/login` by router
navigation, which needs no network, so it asks on a dirty form whether the
phone is online or not. The 426 forced update (`applyUpdateNow`, the sync
engine's own reaction to a server that refuses the build) is not one of the
three — it is not a tap the agent chooses, so there is nothing to ask about.
Outside the field route (the admin update banner, and the update prompt on
`/login`) there is no provider, so `leave` runs its action at once, unchanged
from before #74.

### Account card

The field avatar is a `button` (48px target around the 32px disc) that opens a
card (GH #561). It is a native `popover="auto"` wired with `popovertarget`:
outside tap, Escape and a second tap on the avatar close it with no JS, and no
Radix menu ships to the phone (ADR-0015). It needs iOS 17; the owner confirms
the agents' phones. It is `position: fixed`, 12px from the right and just under
the band (`safe-top` plus `band-height`), because the avatar is always the
last item of the band's row and CSS anchor positioning needs iOS 26. The popover
UA style (`inset: 0; margin: auto`) is reset. The card is a labelled region
(`aria-labelledby` its email), not `role="menu"`: it holds radios and has no
roving focus.

```
                          ┌────────────────────────┐
                          │ francois@captain-      │  email, 12px semibold
                          │ prospectus.be          │  wraps before « @ »
                          │ Agent                  │  role, muted
                          ├────────────────────────┤
                          │ APPARENCE              │  overline
                          │ [▭]  [☀]  [☾]          │  Système · Clair · Sombre
                          ├────────────────────────┤
                          │ Version 0.1.0 · a605114│  muted, 12px
                          └────────────────────────┘
```

`popover` surface (`bg-popover`), 1px border, `shadow-md`, `rounded-lg`, at least
208px wide, never wider than the viewport minus 24px: a long address widens the
card and then wraps before « @ ». Sections are separated by hairlines.
« Apparence » is three native radio tiles of 48px
(the field's `FieldRadioOption`, gold when checked) with a 16px Monitor, Sun or
Moon icon and an `aria-label` instead of a visible one. A pick applies at once,
with no reload. The checked tile reads `<html data-theme>`, Système when there
is no pin or a pin that is not a theme. The version line is the release plus
the first seven characters of the deploy commit, stamped at build
(« · dev » locally).

The card holds no sign-out and no other item: an agent cannot end their own
session. Signing back in needs a fresh admin code, and « Révoquer » is how an
admin ends a device's session.

### Field principles

These extend the five above; they do not replace them.

6. **One decision per screen.** If a screen asks two questions, it is two
   screens.
7. **The next stop is the screen.** The round is context; the next door is the
   content.
8. **Ambient over transient.** A condition that lasts is shown as a standing
   fact. Toasts are for things that happened and are over.
9. **Thumb, not cursor.** 48 px minimum, 56 px for the outcome. Set in the
   vendored component's variant (ADR-0014 decision 5), never per screen.
10. **Legible in sun, at arm's length.** Field body text is `text-base`, one
    step up from the admin's `text-sm`. Inputs are `text-base` too, which also
    stops iOS zooming the form.

### Native controls here

`<input type="date">` for the follow-up date, and the choice controls in
`src/client/ui/field-controls.tsx` rather than Radix's — a native radio group is
not behaviour the platform lacks. That is
[ADR-0015](adr/0015-native-controls-on-the-field-route.md), and it is a
measurement before it is a preference.

**Validation is react-hook-form, here as everywhere else**
([ADR-0018](adr/0018-one-form-stack.md)). That reverses half of ADR-0015 —
deliberately, with its own measurement, because M3's script questions are a
variable list whose rules depend on the outcome. The rules themselves did not
move into the components: the visit form's resolver *is* `toVisit` from
`visit-draft.ts`, and the add-prospect form's is `z.pick` of the shared schema.
What changed is who tracks which control is invalid, not who decides.

The consequence to expect: **the date field looks like the operating system, not
like the admin's controls.** That is not an inconsistency to fix later. On a
phone the OS picker is one thumb, correctly localised and correctly sized at any
text scale, and it costs nothing to download.
