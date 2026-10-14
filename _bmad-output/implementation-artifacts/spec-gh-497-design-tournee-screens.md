---
title: 'docs/design.md decides the tournée screens (story 1.1, #497)'
type: 'chore'
created: '2026-10-14'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '6fae7f62a1d87f9f1ed308029e2c78471ae24d22'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/_bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md'
  - '{project-root}/_bmad-output/initiative-daily-tournee/epic-numbered-tournee/story-docs-design-md-decides-the-tourn-e-screens.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** ADR-0036 adds a start screen, a location dialog, a swipe, frozen stop numbers, an arrêt counter, a Carnet tab, midnight gates and a door-day Visites ledger, but `docs/design.md`, EXPERIENCE.md and the glossary still describe the live nearest-next round, « portes / visites » counters and « Plus tard ». Entries 3–9 and 11 would each have to invent a screen.

**Approach:** Write the design (Sally's role) into `docs/design.md`, one section per build entry and each naming its entry, with every new French string written out; make EXPERIENCE.md and the glossary follow; render key-screen mockups (HTML + PNG, light and dark) from the existing mockup kit. The owner approves in the PR. No code changes.

**Decisions (owner, 2026-10-14):**
- Tab bar: Tournée · Carte · Carnet · Ajouter, Tableau de bord last for an admin.
- Carnet lists every door-day of today. One whose prospect is not in today's tournée (a visit saved after midnight) shows without a number and does not move the counter.
- Spec kept whole above the 1,600-token guideline: one docs-only goal.
- Start swipe (review, 2026-10-14): a pointer tap only nudges the thumb; keyboard and screen readers start it. The WCAG 2.5.1 gap this leaves is accepted.

## Boundaries & Constraints

**Always:** ADR-0036 › Decision is the source; on conflict it wins. Glossary words (Tournée, Arrêt, Carnet, door-day). A stop is an « arrêt » on the field side, never a « visite ». Field rules stay: 48px targets, native controls, no toast for conditions, sync never gated. Every new string in French, sentence case, `{}` placeholders. Comments/docs link the ADR rather than restating it.

**Never:** Touch `src/` (strings are added by the build entries). Redesign the admin round view (entry 12), the recap card or dashboard copy (entries 10, 12). Change the CSV export shape. Promise a stop order from the live position, or a field-side count in visites. Use line numbers as references.

## I/O & Edge-Case Matrix

| Scenario | State | The design must say |
|---|---|---|
| Nothing assigned | Signed in, server says no tournée | Message 1, no gate |
| Never loaded | No pull ever on this phone | Message 2: needs a connection |
| Refused location | Permission denied | Dialog stays; Réglages › Localisation line |
| Coarse readings | Accuracy above threshold | Dialog stays, readings repeat, visible progress |
| Keyboard / SR | No touch | Swipe is a real button; disabled until a position |
| Joiner | Assigned after the swipe | Next number, « Nouveau » |
| Leaver | Unvisited stop reassigned | Gap in numbers, total drops |
| Reopen | Carnet row tapped | Visit form; new visit; counter unchanged |
| Midnight | Form open at 00:00 | Saves first, then start screen |

</frozen-after-approval>

## Code Map

- `docs/design.md` › The field side (intro), Next-stop card, Carte, Tab bar; › The live feed — sections to rewrite or add. The admin round view section stays (entry 12).
- `_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md` — IA Field table, Approved strings (Tournée / Carte, Field shell), Component Patterns (Next-stop card, Daily progress, Plus tard, Carte sheet, Live feed), State Patterns (Empty round, Position denied, Waiting to send), Dashboard metrics (Visites, Agents en tournée — note only, entry 10/12 own the figures), Flow 1.
- `docs/glossary.md` — rows Today list, Admin round view; add Tournée, Arrêt, Carnet, Door-day.
- `src/client/copy/field.ts` (read-only) — `today.progress`, `today.remaining`, `today.later`, `today.positionDenied`, `today.distanceUnknown`, `carte.pinLabel`: the strings being replaced or kept.
- `src/client/field/swipe.ts` (read-only) — `SWIPE_SLOP` 10, `SWIPE_COMMIT` 96: the start swipe reuses them.
- `src/client/copy/shared.ts` `STATUS_LABELS.new` = « Nouveau » — the joiner marker shares the word; the design must keep it visually distinct from a status badge.
- `.../ux-captain-prospectus-2026-09-24/mockups/key-f1-tournee.html` — CSS/token kit to copy for new mockups; PNGs rendered with `/usr/bin/chromium-browser --headless --screenshot`.

## Tasks & Acceptance

**Execution:**
- [x] `docs/design.md` -- add « Before the swipe » under The field side (entries 3, 4); rewrite Next-stop card for « Arrêt {n} », the « {n} sur {total} » counter, gaps, « Nouveau », no « Plus tard » (entries 5, 6, 7); rewrite Carte's numbering and position-denied paragraph (entry 5); add « Carnet » (entry 8) and « Midnight » (entry 9); move Tab bar to five slots; rewrite The live feed for door-day rows and history (entry 11) -- each section names its entry and spells its French strings.
- [x] `EXPERIENCE.md` -- update the rows listed in the Code Map and add start screen, location dialog, Carnet and midnight rows -- the spine must not contradict design.md.
- [x] `docs/glossary.md` -- add Tournée, Arrêt, Carnet, Door-day; rework Today list and Admin round view -- one definition of « Tournée ».
- [x] `mockups/key-t1-start.html`, `key-t2-tournee.html`, `key-t3-carnet.html`, `key-t4-visites-ledger.html` + `.png` -- light and dark frames from the existing kit -- the owner reviews pictures, not only prose.

**Acceptance Criteria:**
- Given design.md, when grepping for each of entries 3–9 and 11, then each has a section naming it.
- Given design.md and EXPERIENCE.md, when searching the field side, then nothing promises a live-position order, « portes … aujourd'hui », « visites sur », or « Plus tard » on Tournée.
- Given the glossary, when reading « Tournée », then exactly one row defines it.
- Given the mockup PNGs, when opened, then each shows the strings design.md decides.

## Implementation Notes

- Mockups were rendered and approved by the owner **before** the docs were written (owner's request, 2026-10-14). Generated from a throwaway Python kit in `/tmp` (not committed) on the `key-f1-tournee.html` tokens; PNGs by Playwright's headless Chromium.
- After approval, Carnet's outcome badge and edge were neutralised: an outcome colour on the phone previews a status, which EXPERIENCE.md rejects on principle and `VisitHistory.tsx:43` already avoids. Mockup `key-t3-carnet` re-rendered; flagged to the owner in the PR.
- Implemented directly, not through a subagent: the owner declined the subagent spawn to review mockups first, and the session held the whole context.
- design.md: new « Before the swipe », « Carnet », « Midnight »; rewritten « Next-stop card », Carte numbering and position paragraph, Tab bar (five slots), « The live feed » (door-days); touch-ups in Saving asks once, the visit map pane and Adding a place. The admin round view gets a one-line *Pending* pointer only (entry 12 owns it).
- During review, design.md was edited outside this session's own writes (ledger rows dated « 14/10 », a singular accessible name, Carte's total-0 message, the numberless Carnet name, a full-width completion card from 768px, a « button is disabled » line). All kept except the last, rewritten as `aria-disabled`; flagged in the PR.
- Docs now describe ADR-0036's screens ahead of the code: entries 3–12 build them. The glossary's Today list and Admin round view rows say what those screens become.

## Spec Change Log

## Review Triage Log

Pass 1 (blind-hunter and edge-case-hunter re-run on Sonnet after an Opus session limit; verification-gap and intent-alignment on Opus). Counts: high 0 · medium 11 · low 9 · false 6 · maybe-false 1. Routes: patch 18 · defer 1 · intent_gap resolved by the owner in-session (start swipe) · rejected 9.

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| Swipe commit stated as 3/4 track and as SWIPE_COMMIT 96px (mockup caption) | medium | patch | design.md says the commit is track-relative and only lockAxis/SWIPE_SLOP are reused; T1 caption fixed |
| No single-pointer alternative to the swipe (WCAG 2.5.1, TalkBack) | medium | intent_gap → owner | Owner kept tap = nudge; recorded as a decision; design.md names `detail` 0 and the accepted gap |
| Double activation while « Démarrage… » | low | patch | Button `aria-disabled`, ignores drag/key/click while writing |
| Dialog never passes the threshold | medium | patch | Sentence: no way past in T1, agent calls the admin (ADR-0036 › Consequences) |
| Reading lost between dialog close and swipe | maybe-false (low) | rejected | `useAgentPosition` keeps the last point; would need a failure that clears it, not shown |
| Joiner "highest" ambiguous; returning leaver | medium | patch | Highest ever given, left stops included; a returning stop keeps its number, no « Nouveau » (R10 unique per tournée+prospect) |
| Two phones swipe offline | medium | patch | Losing phone takes the server's numbers at its next pull (epic decision) |
| Ajouter across midnight: which tournée | medium | patch | Writes the place only; joins the new day's snapshot |
| Phone clock skew at midnight | low | rejected | Server clamps visited_at (invariant 12); rare, fix adds a rule |
| No retry for distances after « Réessayer » removed | low | patch | Each screen's reading on open is the retry |
| Carnet reopen on a reassigned prospect → quarantine | medium | defer | deferred-work.md; needs entry 2's contract |
| Ledger "latest" by visited_at vs received_at | medium | patch | Latest = greatest clamped visited_at; order = greatest received_at |
| Open ledger row across pages / reseed | low | patch | A period, reason or page change closes it |
| Merged-prospect door-day counted differently | false | rejected | One door-day reader (entry 2) feeds the ledger and the figures alike |
| Five tabs at 200 % text | low | rejected | Pre-existing reflow rule; four tabs already shipped; not everyday |
| field-operations.md still describes the live round | low | rejected | R16: entries 3–9 each update it; outside this story's three files |
| Spec Design Notes: « Mardi », « Recherche d'une position précise… », line-number ref, empty logs | false | rejected | Fix would edit this build's spec; docs and mockups are right |
| Gate screens strand an admin (no tab bar) | medium | patch | Admin gets a « Tableau de bord » button on gate screens; agent with no tournée has no Ajouter by ADR |
| Midnight « Visite enregistrée » hidden under the dialog | medium | patch | Shown inside the dialog above its title; T3 frame 3 re-rendered |
| EXPERIENCE metrics still count visits | medium | patch | *Pending ADR-0036* notes on Visites, Flyers remis, Agents en tournée |
| EXPERIENCE admin round view stale | low | patch | *Pending* note on the IA row |
| Back links row missing « Retour au carnet » | low | patch | Row updated |
| Gap ambiguous (visited stops also vanish); Carte sentence garbled | medium | patch | Rewritten: a missing number is done or left; Carnet says which |
| Follow-up « Aujourd'hui » vanishes into done | false | rejected | design.md: reopened from Carnet, whose row shows « À relancer » |
| Glossary Tournée "Not: today's list" vs Today list row | low | patch | Removed from Not |
| Ledger reason filter vs export count differ | false | rejected | Documented deliberately in design.md (R12 vs raw history) |
| Mockups not regenerable | low | rejected | The committed HTML is the source and is hand-editable, like key-f1…f8 |
| Missing a11y names: numberless Carnet row, ledger disclosure | low | patch | Both names written out |
| Card shows « Arrêt {n} » only as accessible name | false | rejected | Owner approved the mockup (disc + « Prochain arrêt ») |
| Flow 1 links key-f1 with old strings | low | patch | Flow 1 points at key-t2; key-f1 marked as history |
| Glossary Carnet row drops the numberless exception | low | patch | Added |
| Glossary admin round view describes unbuilt behaviour | low | patch | design.md and EXPERIENCE carry *Pending* pointers to entry 12 |
| PNGs absent from the diff | false | rejected | Binary files excluded from the text diff on purpose; on disk |
| Verification gap lens | — | — | No gaps: docs and mockups only, no test or CI step reads them |

## Design Notes

Decisions taken here (the owner can overturn any in review):
- **Counter**: under « Tournée du jour », bold tabular « {n} sur {total} » with the existing 8px bar; accessible name « {n} arrêts faits sur {total} ». No « arrêts » line beside it.
- **Card**: overline « Prochain arrêt », disc shows the swipe number; aria « Arrêt {n} ». Absent when every stop is done: « Tous les arrêts sont faits. Retrouvez-les dans Carnet. »
- **« Nouveau »**: an outline badge after the name (not the `secondary` status-badge fill), so it never reads as status `new`.
- **Start screen**: date « Mardi 14 octobre », « {20} arrêts », the stop names in a quiet unnumbered list (numbers do not exist before the swipe), then the swipe track « Glisser pour commencer la tournée » with its thumb; the same control is a `<button>` « Commencer la tournée ». Disabled state: « En attente de votre position ».
- **Location dialog**: shadcn AlertDialog, the start screen visible behind the scrim; title « Activez la localisation », body « Votre position fixe l'ordre des arrêts pour la journée. », action « Activer », line « Refusée ? Ouvrez Réglages › Localisation, puis revenez ici. »; while repeating: « Recherche d'une position précise… » then « Précision : {350} m. On affine… ».
- **Carnet row**: number disc, name, « type · address », latest outcome as a neutral badge (no status colour, no edge: invariant 3, EXPERIENCE.md), time « 10:42 »; a second visit adds « 2 visites ». No count in Carnet's header. Empty: « Aucun arrêt fait aujourd'hui. » « Chaque arrêt enregistré arrive ici, avec son résultat. »
- **Visites ledger**: row = latest visit's time, name, latest outcome, flyer if any visit gave one, agent, and « {2} visites » when >1; tap expands in place (no dialog) listing every visit oldest first.

## Verification

**Commands:**
- `pnpm lint` -- expected: green (no code changes; `.prettierignore` skips `*.md`, so this only proves nothing else moved).
- `grep -nE "portes sur|visites sur|Plus tard|triée par distance" docs/design.md _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md` -- expected: no field-side hit outside history notes.

**Manual checks:**
- Open each mockup PNG; compare its strings with design.md.
