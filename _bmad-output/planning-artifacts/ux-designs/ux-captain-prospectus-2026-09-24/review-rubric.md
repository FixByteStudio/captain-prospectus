# Spine Pair Review — captain-prospectus

## Overall verdict

The pair is a usable contract: every `{path.to.token}` reference in both files resolves, the canonical section order holds, the glossary matches `docs/glossary.md` verbatim, and the #91 edit left no stale hex or stale ratio claim anywhere in the prose — all twelve ratios quoted in the frontmatter comments reproduce exactly when measured. The edit did, however, invert one load-bearing rule it did not revisit: the chart's dark-mode in-segment count now assigns near-white text to the series the same file calls "lightest in dark", which measures 1.59:1 and contradicts the new mockup's own rendering. Two other things went stale around the edit — `mockups/key-a1-dashboard.html` still paints the pre-#91 outcome colours while DESIGN.md still advertises it as showing them, and EXPERIENCE.md still counts "six files in `mockups/`" where there are now seven.

## 1. Flow coverage — adequate

`sources` names no PRD or UJ list; the inheritable requirement set is `docs/vision.md` › Core jobs (1 Build the prospect base · 2 Assign · 3 Visit · 4 Revisit · 5 Discover · 6 Monitor). Extracted those six against the four Key Flows and the IA closure check.

### Findings
- **medium** Core job 1 (*Build the prospect base*, CSV and map import) has no Key Flow, although Import is the most stateful admin surface in the spine — a stepper, two paths, an in-browser file read, a 250-row batch loop, a leave-confirmation, three failure states (EXPERIENCE.md:138–139, 164–166). Core job 4 (*Revisit*) likewise has none; it exists only as the "Plus tard" row (EXPERIENCE.md:146). A story-dev consumer gets the parts but never the walk-through that orders them. *Fix:* add a fifth flow for a CSV import including the mid-way failure, and fold the revisit beat into Flow 1 or Flow 2.
- **low** Flows 2 and 3 have no named protagonist — both run on "the admin" (EXPERIENCE.md:287, 297), where Flows 1 and 4 name Léa and Karim. *Fix:* name the admin once and reuse.
- **low** Flows 2 and 4 carry no failure path, though both have failure states defined elsewhere: assignment failure (EXPERIENCE.md:162) and position-denied on Ajouter. *Fix:* one failure line each, as Flows 1 and 3 already do.
- **low** The closure check (EXPERIENCE.md:72–83) renames the source's jobs (*Build the prospect base* → "Import", *Monitor* → "Watch visits", *Discover* → "Add a place"). The mapping is correct but has to be re-derived by hand. *Fix:* quote the vision's job names in the left column.

## 2. Token completeness — adequate

Parsed the frontmatter to a path set and matched every `{…}` occurrence in both files: **all references resolve**; the only unmatched braces are copy placeholders (`{n}`, `{date}`, `{412}`) and breadcrumb slots. Every colour token has a `-dark` counterpart. Recomputed all twelve contrast figures quoted at DESIGN.md:63–70 — every one is correct to two decimals. Recomputed the claims at DESIGN.md:276–281: gold 2.42 (stated 2.4), navy on gold 5.88 (5.9), `primary-edge` 3.38 (3.4), warn pill 4.68 (4.9 — see below).

### Findings
- **high** Palette rule 5 ("Status and outcome badge text on its tint reaches 4.5:1", DESIGN.md:280) is unsatisfiable for the new no-contact value. `components.outcome-badge` (DESIGN.md:168–171) defines `background` but **no `foreground`** — unlike `status-badge`, which does. On the natural reading (text = the outcome colour), `#8A92A4` on its 12 % tint is **2.79:1** light and `#6A7489` **3.05:1** dark; dropping the tint as rule 5 instructs cannot rescue it, because `#8A92A4` on pure white is only 3.12:1. Ceiling is the colour, not the tint. (`#9A6B12` at 12 % is 4.02:1 and `#8E9399`-dark 4.40:1 — those two *are* fixable by the tint escape hatch.) *Fix:* give `outcome-badge` an explicit `foreground` (e.g. `{colors.foreground}` / `{colors.muted-foreground}` for Personne sur place, as the Nouveau status row already does) and say so in rule 5, or exempt no-contact in writing.
- **medium** Rule 6 and the frontmatter comment both say "3:1 against `{colors.card}` in its own theme" (DESIGN.md:59, 281), but `{colors.card}` is literally `#FFFFFF`; the dark half means `{colors.card-dark}`. A `palette.test.ts` written to the rule as stated measures `#AEBBDB` against white and gets **1.92:1** — a false CI failure, or a silently wrong assertion. *Fix:* "3:1 against `{colors.card}` in light and `{colors.card-dark}` in dark".
- **low** Rule 6 covers the outcome set but exempts the status edges without saying why — `{colors.status-new}` is **1.37:1** against the card (1.57 dark) and `{colors.status-assigned}` 3.47:1, and both are 4px colour-coded graphical objects. The exemption is defensible (every edge is paired with a labelled badge) but is not written down next to the rule that would otherwise catch it. *Fix:* one clause in rule 6 naming the pairing as the reason.
- **low** DESIGN.md:352 states the warn count pill with white numerals at 4.9:1; measured **4.68:1**. Still AA for the pill's ≥14px bold-ish meta, but the number is wrong and the file's other ratios are exact.

## 3. Component coverage — adequate

Extracted 27 rows from EXPERIENCE.md › Component Patterns and 26 entries from DESIGN.md › Components, plus the 24 frontmatter `components.*` keys, and matched them three ways. Names are consistent across sections (only "Outcome card"/"Outcome cards" and "Stepper (import)"/"Import stepper" differ, both trivially). No one-word descriptions on either side — every row carries real rules.

### Findings
- **medium** Six EXPERIENCE components have behaviour but no visual spec anywhere in DESIGN.md › Components: **Period selector** (EXPERIENCE.md:128), **One toolbar slot** (133 — a bespoke swap-in-place that asserts "same position and height" with no height given), **Map import** (139), **Doublons pair** (140), **Table pagination** (136 — and `Pagination` is absent from the shadcn-defaults catch-all at DESIGN.md:338, so nothing covers it), **Plus tard** (146). *Fix:* one line each under Components › Admin / Field, or add `Pagination` to the defaults list.
- **medium** The reverse gap sits exactly where the #91 edit landed. **"Pipeline par statut"** has a full visual spec (DESIGN.md:345) and no behavioural row — is a bar clickable, does it filter Prospects? And the **outcome badge**, which the edit made a second consumer of the new colours (DESIGN.md:269), appears in no EXPERIENCE row at all: nothing says which surfaces show one (Visites feed? À rattacher?) or how it behaves. "Visites dans le temps" got its behavioural counterpart; its sibling did not. *Fix:* add both rows to Component Patterns.
- **low** **Admin round view** and the **tab bar** have visual specs (DESIGN.md:359, 374) and no behavioural rows; their behaviour is scattered across IA, State Patterns and Flow 3. Recoverable, but not extractable in one pass.

## 4. State coverage — adequate

Walked all 8 admin surfaces and all 8 field surfaces against empty / cold-load / error / offline / permission-denied / focus. Field coverage is genuinely strong: 11 rows cover the whole sync lattice (offline, waiting, syncing, failed, expired, 426) and every one ties back to invariant 5.

### Findings
- **high** The **admin** surface has no offline, no session-expired and no permission-denied state, although Foundation makes all three reachable: the admin is online-only (ADR-0019, EXPERIENCE.md:21) so the network *will* drop mid-session, Cloudflare Access sessions expire, and the field IA gates a whole tab on "admins only" (EXPERIENCE.md:67) with nothing said about what a non-admin sees. The field side specifies its equivalents in detail; the admin side specifies none. *Fix:* three rows — admin offline, admin Access-session expired, non-admin hits an admin route.
- **medium** **Scripts** has no empty state (no script configured yet — the first-run path for a new deployment) and no save-failure state, though its save-success path is specified twice (EXPERIENCE.md:167, 162). *Fix:* two rows.
- **low** **Tableau de bord** has no cold/zero-data state. "Empty feed" covers Dernières visites, but not the KPIs, the chart or Pipeline on day one — which is precisely the surface the #91 edit touched. *Fix:* one row saying what "Visites dans le temps" shows with no visits in the period.
- **low** "Position denied" is scoped to Tournée du jour and Carte (EXPERIENCE.md:174); **Ajouter**'s "Utiliser ma position" (153) can be denied too and isn't covered. *Fix:* extend the row's surface list.

## 5. Visual reference coverage — adequate

Inventoried 7 files in `mockups/`, 7 in `imports/`, 2 Stitch trees; no `wireframes/`. DESIGN.md › Sources and mockups names all 7 mocks with what each shows; EXPERIENCE.md cites the inspiration import by name and the `current-*` screenshots as a superseded group. Spines-win-on-conflict is stated once per file (DESIGN.md:401, EXPERIENCE.md:86) — correct, not duplicated within a file. No orphans.

### Findings
- **high** `mockups/key-a1-dashboard.html` was not re-rendered for #91: its CSS still defines `--o-nc:#DDE0E5 / --o-int:#4F5E81` (light) and `#3A4356 / #98A6CD` (dark) — the exact values the memlog records as superseded — while DESIGN.md:403 still advertises that file as showing "the outcome colours in both themes". A consumer who opens the dashboard mock to sample a series gets the withdrawn palette, and the spines-win clause silently shifts the burden to them. *Fix:* re-render the mock, or strike the "Also the outcome colours in both themes" clause and point that sentence at `key-a1-outcome-chart.html`.
- **medium** EXPERIENCE.md:88 still reads "**six** files in `mockups/`"; there are seven since `key-a1-outcome-chart.html` landed. *Fix:* drop the count, or say seven.
- **medium** The new mock is linked only from DESIGN.md › Sources (line 409). It is not linked inline at Colors (:269–271) or at Components › Charts (:345), where its rules live, and not at all from EXPERIENCE.md — neither the "Visites dans le temps" row (:129) nor the Accessibility Floor bullet (:213), both of which the same edit wrote. The rubric's own standard is an inline link at the relevant section. *Fix:* three inline links.

## 6. Bloat & overspecification — strong

EXPERIENCE.md prose is flat and behavioural throughout; the editorial voice stays in DESIGN.md § Brand & Style, where it belongs. Tables are used where tables work. No source restatement of the ADRs — they are cited, not summarised.

### Findings
- **medium** DESIGN.md carries `status: final` while EXPERIENCE.md:54 still holds an `[OPEN QUESTION]` on what the notifications bell announces — a load-bearing decision left uncommitted in a document declared final, on a control the top bar renders on every admin surface (DESIGN.md:353). *Fix:* either commit it or move the bell out of the top-bar spec until it is decided.
- **low** Foundation's "Dependencies before build" table (EXPERIENCE.md:25–32) opens by saying "None of these are UX decisions". It is sequencing work for a PR or the backlog, and no downstream consumer reads a UX spine for it. *Fix:* move it to the issue that schedules the build.
- **low** A handful of pixel literals in prose restate tokens that already exist: "A 56px white top bar" (DESIGN.md:310) = `components.top-bar.height`, "Rows are 44px" (:344) = `{spacing.row}`. *Fix:* use the token; the frontmatter is the one home.

## 7. Inheritance discipline — adequate

`sources` in both files resolve (`docs/vision.md`, `docs/glossary.md`, both domain docs and `docs/design.md` all exist). Glossary terms are verbatim: the five outcome labels and five status labels in DESIGN.md:260–269 match `docs/glossary.md`:33–45 exactly, and the metrics table uses the English DB values (`new`, `assigned`, `follow_up`, `next_visit_at`, `flyer_given`) correctly. EXPERIENCE.md's single `{colors.*}` reference resolves.

### Findings
- **critical** The chart's dark-mode label rule and the file's own lightness ordering contradict each other, and the edit created the contradiction. DESIGN.md:345 says the in-segment count is "`{colors.foreground-dark}` on the lightest series and `{colors.primary-foreground-dark}` on the rest"; DESIGN.md:271 — written in the same edit — says Intéressé is "darkest in light and **lightest in dark**". Taken together, `#E7EAF0` lands on `{colors.outcome-interested-dark}` `#AEBBDB` at **1.59:1**. `mockups/key-a1-outcome-chart.html`:121 does the opposite (`onD=["#E7EAF0","#141C2E",…]`, i.e. light ink on the *darkest* series), so prose and mockup disagree and the spine wins by declaration. This is not a decorative detail: EXPERIENCE.md:213 states the in-segment count is one of the two cues that satisfy WCAG 1.4.11 and "neither may be dropped". Even the mockup's own mapping only reaches **3.9:1** (`#E7EAF0` on `#6A7489`) and `#141C2E` on `#6A7489` is **3.62:1** — so no assignment in play meets 4.5:1 for the dark no-contact segment. Light mode is fine (navy on `#8A92A4` = 4.56:1, white on the other four ≥ 4.68:1). *Fix:* restate the dark rule by token rather than by superlative — `{colors.primary-foreground-dark}` on `{colors.outcome-interested-dark}`, `{colors.outcome-not-interested-dark}`, `{colors.warn-dark}` and `{colors.success-dark}`; and for `{colors.outcome-no-contact-dark}` either lighten the token until dark ink clears 4.5:1 or drop the in-segment count there and say the tooltip carries it.
- **low** `sources` mixes two base paths without saying so: `.memlog.md` and `DESIGN.md` are workspace-relative, `docs/*` is repo-root-relative. *Fix:* prefix the repo paths.

## 8. Shape fit — strong

DESIGN.md runs Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts: all eight present, canonical order intact. "Sources and mockups" is appended after Do's and Don'ts, so it does not break the order lock, and it earns its place as the mockup index. EXPERIENCE.md has all eight required defaults; the three additions (Responsive & Platform, Dashboard metrics, Inspiration & Anti-patterns) all pay for themselves — "Dashboard metrics" in particular gives each figure exactly one home, which is what stops the Worker and the UI drifting. No findings.

## Mechanical notes

- **Frontmatter.** Both files parse as YAML. DESIGN.md carries every spec'd key (`name`, `description`, `colors`, `typography`, `rounded`, `spacing`, `components`) plus `status`/`updated`/`sources`. 48 colour tokens, all with `-dark` pairs; 8 typography roles; 6 radii; 10 spacing tokens; 24 component entries.
- **Cross-refs.** No broken `{…}` reference in either file. All 9 `mockups/*.html` links in DESIGN.md and EXPERIENCE.md point at files that exist; `reconcile-stitch.md` and `imports/inspiration-shadcn-saas-ai-dashboard.png` exist.
- **Stale-hex sweep (issue #91).** No literal hex appears anywhere outside DESIGN.md's frontmatter — the prose and EXPERIENCE.md reference colours by token only, so the edit could not leave a stale hex in the spines, and it did not. The only stale colour values in the workspace are in `mockups/key-a1-dashboard.html` (§5). No stale contrast claim survives either: the three superseded ratios appear only inside `key-a1-outcome-chart.html`'s "was → now" comment, which is correct as history.
- **Name consistency.** "Outcome card" (DESIGN) vs "Outcome cards" (EXPERIENCE); "Stepper (import)" vs "Import stepper". Cosmetic.
- **Mermaid.** None used in either file; nothing to check.
