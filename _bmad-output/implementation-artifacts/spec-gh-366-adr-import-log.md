---
title: 'ADR: the server keeps an import log'
type: 'chore'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: [quick]
review_loop_iteration: 0
baseline_commit: '387092c2273f4eda2be925b067d42bbac0dd5974'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing records an import, so Source cannot list « Derniers imports » (epic #363, R3). Entries 7 and 8 need a decided table, request field, read route, re-send rule and « Interrompu » rule first.

**Approach:** Write ADR-0030 with the new-adr skill (status `proposed` until the owner accepts). It decides the grouping of 250-row batches, the stored columns, once-only counting (invariant 4), when an import reads Terminé / Interrompu / neither, retention (ADR-0023 style), the glossary term and the additive field on `POST /api/admin/prospects/batch`. Docs and code are left to entries 7 and 8.

</frozen-after-approval>

## Implementation Notes

Oneshot: a single new doc plus its README row. The open question (Interrompu without a closing call) is answered in the ADR: the client sends `batchCount` up front and the server compares after a timeout.
