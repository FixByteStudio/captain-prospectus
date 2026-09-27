# Epic 117 Context: Agents work their round on the new field app

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Rebuild the field app's working screens in the new design, one screen per story: Tournée du jour (`/tournee`), a new Carte tab (`/tournee/carte`, lazy Leaflet), Visite in two steps with a save confirmation (`/tournee/:id`), and Ajouter un prospect (`/tournee/nouveau`). Tournée du jour also gains a daily progress count, which needs a small client-only Dexie log of the visits sent today (server-gap G8). The agent should be able to walk the round, record visits and add places, all offline. The epic succeeds when EXPERIENCE.md Flow 1 (a visit on the round) and Flow 4 (adding a place) run end to end in airplane mode, on a phone and a tablet, in light and dark. The rest of the field shell (band, sync strip, tabs) belongs to epic-shared-shell. The admin round view (epic-admin-round-view) is out of scope, but it reuses this epic's StopRow, StopNumber and map components.

## Stories

- Story 117.1: Tournée du jour
- Story 117.2: Daily progress
- Story 117.3: Swipe actions on stop rows
- Story 117.4: Carte: lazy map and tab
- Story 117.5: Carte sheet and tablet panes
- Story 117.6: Visite step 1: Résultat
- Story 117.7: Visite step 2: Questions
- Story 117.8: Save sheet and dialog
- Story 117.9: Visite tablet layout
- Story 117.10: Ajouter un prospect
- Story 117.11: Refactor sweep
- Story 117.12: Flows 1 and 4 on a real phone and tablet

## Requirements & Constraints

- **Agents only insert (invariant 2).** A swipe, a tap or any other field action may start only Visiter or Y aller, and never an edit of shared data.
- **No status preview (invariant 3).** The phone never shows or implies the status an outcome leads to.
  - Outcome cards stay neutral before and after selection, with the same neutral icon colour for all five.
  - Hints describe the outcome, never its effect ("Refus clair.", not "passe en Refusé").
  - The admin-only `outcome-*` colours never appear on the field.
- **Daily progress.** The line reads "{n} visites sur {total} aujourd'hui", with a bar.
  - `n` is the local log of today's sent visit ids plus the pending outbox rows, deduplicated by visit id.
  - `total` is `n` plus the stops still on today's list.
  - The count survives a sync that empties the outbox, and a reload. It never gates outbox deletion: the outbox still clears only on `accepted` (invariant 5).
  - Show only the count and the bar: no percentage, no ETA, no "restants".
- **Offline.** Every field state renders offline: empty round, position denied, and waiting to send ("Pas encore envoyé" on the stop's row).
  - Offline, Carte shows "Carte indisponible hors ligne. La liste reste à jour." with "Voir la liste" and the sheet, and makes no tile request.
  - Tiles load only online and are never bulk-cached (OSM tile policy).
  - Every map shows the OSM attribution (invariant 11).
- **Size (ADR-0026).**
  - The field precache is at most 1,000 KiB, and every PR quotes the precache total and the entry chunk.
  - Leaflet must stay out of the entry chunk. It lives in a lazy chunk that is still precached, so Carte works offline.
  - The entry chunk has no cap, but it is still measured.
- **Visite.** Saving writes exactly one outbox row. "Modifier" loses nothing that was typed.
  - Step 1 requires an outcome. Without one, "Choisissez un résultat." shows under Résultat and takes focus.
  - Step 2 saves by scrolling to and focusing the first invalid answer. With Personne sur place, no answer is required.
  - When the visit has no script, it is one step with no indicator, and the button reads "Enregistrer la visite".
- **Ajouter.** Nom and Type are required ("Indiquez le nom de l'établissement." when Nom is empty). The new place joins the round as a stop at once, offline.
- **Copy and docs.**
  - Every French string goes in `copy.ts` (invariant 15). The approved new strings are listed in EXPERIENCE.md › Voice and Tone.
  - `docs/design.md` rewrites its Tournée, visit and "Adding a place" sections in the same change as the screen (CAP-11).
  - `docs/design.md` keeps the rules the spines don't cover: the map import, "Working with shadcn in this repo", and Icons.
- **No new dependency and no server change.** Swipe is a pointer handler with no library. A routing service would bill (ADR-0002), so the walking path is straight lines between stops.

## Technical Decisions

- **G8, the daily progress log.** It is a Dexie version 3 store of today's sent visit ids. It is written when a visit is queued and pruned to today, assumed to be the device's local midnight. There is no sync-contract change.
  - Story 2 exposes the one queueing function, and the save sheet (story 8) calls it, so the progress count and the outbox share one write path.
  - The story is high risk. Follow the `sync-contract-change` skill's outbox step.
  - Add a test that upgrades a version 2 database holding outbox rows and checks every row survives.
- **Walking order** stays as `today.ts` computes it.
- **Shared components.** StopRow and StopNumber (story 1) and the map component (story 4) are shared.
  - Carte, the visit tablet pane and the admin round view all reuse them.
  - The visit's tablet map reuses Carte's map component, so Leaflet stays in one shared lazy chunk.
- **Field controls.** The date input, radios, checkboxes and labels stay native (ADR-0015, ADR-0026). Outcome cards and choice tiles are styled over native radio and checkbox semantics.
  - Everything else is a vendored shadcn component: Dialog and Sheet for the save confirmation, Progress for daily progress.
  - Forms use shadcn `form` over react-hook-form, with the shared validators (ADR-0018).
- **Swipe.**
  - Swiping left opens Visiter, and swiping right opens Y aller.
  - Assume `touch-action: pan-y`, so vertical scrolling is never taken over.
  - Under `prefers-reduced-motion`, the panel reveal is instant.
- **Y aller** opens the phone's maps app with walking directions to the stop.
- **Open questions.**
  - The dark look of the map tiles is unsettled (#27).
  - Can the persistent, non-modal Carte sheet be a shadcn Sheet, or does it need to be a plain panel?

## UX & Interaction Patterns

- **Field layout.**
  - The field is thumb-first: every target is at least 48px, and outcome cards are at least 56px.
  - There is no long-press, no pull-to-refresh and no hover-only affordance. Text and inputs are at least 16px.
  - Numbers use tabular figures in fr-FR format ("350 m", "1,4 km").
- **Gold** marks only the main action and the current selection. It is always a fill with navy text and the `primary-edge` border, and is never used as text or as the focus ring.
  - The daily progress bar is gold by deliberate exception.
  - Converti is never gold.
- **Tournée du jour.**
  - The next-stop card has a 4px gold left edge, a gold StopNumber, the name, "type · address" and the distance, then equal "Y aller" (secondary, Navigation icon) and "Visiter" (primary, ClipboardCheck icon) buttons.
  - A stop row shows a secondary-disc number and a 4px status-colour edge. Tapping it expands it in place to show the same two buttons. Mid-swipe, the row reveals a gold "Visiter" panel or a secondary "Y aller" panel.
  - "Plus tard" lists follow-ups that are not yet due, with "À relancer le {date}". They cannot be visited from here.
  - Empty round: "Aucun prospect à visiter. Synchronisez pour récupérer votre liste."
  - Position denied: "Sans votre position, la tournée n'est pas triée par distance." with "Réessayer", and distances read "Position inconnue".
- **Carte.**
  - Pins are numbered in walking order: gold for the next stop, card-coloured for the others.
  - The agent's position is a navy dot with a halo. The walking path is a 3px dashed gold line.
  - Controls are 44px white squares at the bottom right, including re-centre (aria "Me recentrer").
  - The sheet shows the next stop and always sits above the tab bar. Tapping a pin moves the sheet to that stop.
- **Visite.**
  - The step indicator reads "Étape 1 sur 2 · Résultat" or "Étape 2 sur 2 · Questions", after a 6px gold dot.
  - Step 1 has Flyer remis, five outcome cards (a neutral icon tile, the label, a one-line hint, a radio disc), and "Relancer le" with a native date input, revealed by À relancer. It also shows Visites précédentes.
  - A selected outcome card gets a 2px gold-edge border, a 12 % gold wash and a check.
  - Step 2 has yes/no pairs, single-choice rows, 1–5 rating tiles and a number stepper. The stepper is − / + at 48px, typeable, and never below 0.
  - Back links: step 1 has "Retour à la tournée", and step 2 has "Résultat", which keeps the draft.
- **Save confirmation.**
  - The confirmation has an overline "Validation", "Enregistrer cette visite ?", a summary on secondary, the reassurance line, then "Enregistrer" (primary) above "Modifier".
  - On a phone it is a bottom sheet, and from 768 px a centred dialog with the buttons side by side.
  - Enregistrer returns to Tournée du jour with the existing "Visite enregistrée…" message.
- **Ajouter.** Type chips sit in two columns. "Utiliser ma position" shows a position preview, then reads "Actualiser".
- **From 768 px (tablet).**
  - Tournée shows the list on the left (≈40 %) and the next stop on the right.
  - Carte shows the list on the left and the map on the right.
  - Visite shows the form on the left and the history and map on the right. The map is absent below 768 px.
- **Visual references.** Build from `mockups/key-f1-tournee.html`, `key-f2-carte.html` and `key-f3-f5-visit.html` at 390 and 820 px, in light and dark. DESIGN.md and EXPERIENCE.md win over any mock.

## Cross-Story Dependencies

- **Story 1 is the tracer bullet.** It waits on epic-dashboard's 104.1 (#105, done) and on shared-shell's ADR-0026 acceptance and Field tabs (#66, done).
  - Stories 2, 3 and 10 build on story 1.
  - Story 6 also waits on 104.1, so nothing here touches `app.css` while 104.1 and 104.2 run.
- **Carte (story 4)** waits on story 1 and on epic-dashboard's 104.11 (#115, "Tableau de bord tab ignores a lost network", still in backlog), because both edit `tabs.ts`. Story 5 follows story 4.
- **The visit lane** runs 6 → 7 → 8. Story 8 also needs story 2's queueing function. Story 9 needs story 4 (the map component) and story 8.
- **Closing stories.** Story 11 waits on stories 1–10. Story 12 is a person running Flows 1 and 4 on real devices after story 11, recording the result, the device and the date in the epic's Notes.
- **epic-admin-round-view** waits on this epic, because it reuses Carte's map, pin and stop-row components.
