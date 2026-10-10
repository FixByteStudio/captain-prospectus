---
title: 'A running import shows a named progress card (GH #370)'
type: 'feature'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: 'f410c3f2b580d2eeb9c26e2d088026c7f4ee641f'
context:
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** While batches run, Aperçu & validation shows an unnamed bar and a grey line; neither import progress bar has an accessible name (#231).

**Approach:** A fixed bottom-right card on Aperçu & validation (« Import en cours », done / total in `.tnum`, ink Progress). Progress gains an `ink` variant (gold stays the default); Zone's bar takes it without a card. Both bars get an admin-copy accessible name. Retour, « Importer {n} lignes » and the `beforeunload` guard are unchanged. Closes #231.

</frozen-after-approval>

## Implementation Notes

Oneshot: ~80 lines across six files, one component. Decisions per the ticket (2026-10-10): the Zone bar is ink too; gold stays for daily progress and Taux de conversion.

## Review Triage Log

- low (rejected): card overlaps the bottom bar's action — intended by docs/design.md (« floats over the bottom bar »); phone-width check is manual.
- low (rejected): `role="status"` mounted already populated may not be announced — the bar itself carries the accessible name (#231); a pre-mounted live region would add more than a correction.
- low (rejected): the ink track class is not asserted — the fill is, and the track is cosmetic.
- false: Retour / Importer disabled assertions — the existing ImportScreen test still holds them, untouched.
