---
tracker_id: "246"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/246"
tracker_status: backlog
type: epic
title: "A refusal carries its reason"
parent: initiative-dashboard-redesign
covers: []
after: []
assignee: ""
risk: medium
---

# A refusal carries its reason

## Description

A Pas intéressé visit stops asking for the script and records one refusal reason from a fixed list. Admins then read, filter and export refusals by reason, and fix prospects an agent reported Hors cible. The requirements are set by `spec-not-interested-skips-script` (CAP-1 to CAP-7).

## Outcome

Agents log a refusal in one tap, and the owner sees why Brussels says no to Captain Food. This is the spec's success signal.

## Requirements

The spec's capabilities are the requirement source. There is no redesign CAP above them, so `covers` is empty and each line cites the spec.

- CAP-1: On Pas intéressé, one refusal reason replaces the script's questions. (spec, CAP-1)
- CAP-2: The reason comes from the fixed list of 7 in `refusal-reasons.md`. (spec, CAP-2)
- CAP-3: The server stores the reason, and old builds still sync. (spec, CAP-3)
- CAP-4: The Visites ledger shows the reason. (spec, CAP-4)
- CAP-5: Visites and its CSV export filter by reason. (spec, CAP-5)
- CAP-6: The docs define the reasons and the rule. (spec, CAP-6)
- CAP-7: A "Hors cible signalé" to-fix filter on Prospects. (spec, CAP-7)

## Done when

1. On a seeded local build, a Pas intéressé visit saved offline with "Trop d'applis / de tablettes" syncs, Visites shows that label, and the prospect is `rejected`.
2. A visit from a build without the field, with no `refusalReason`, still syncs and is stored with a null reason.
3. Visites filtered on one reason and the CSV export with the same filter list the same visits, and the CSV carries `refusal_reason`.
4. A Hors cible visit puts the prospect in "Hors cible signalé" with a count. A direct admin edit takes it off; an assign, merge or import doesn't.
5. `pnpm lint`, `typecheck`, `test` and `build` are green, and the build's precache line reads at or under 1,000 KiB.

## Boundaries

Covers the refusal step on the field route, the visit contract and column, Visites, and the Prospects filter. Out of scope: the spec's non-goals, including a dashboard chart of reasons, an editable list, and an admin view of one prospect's visit history.

## References

- spec — _bmad-output/specs/spec-not-interested-skips-script/SPEC.md
- spec — _bmad-output/specs/spec-not-interested-skips-script/refusal-reasons.md
- companion — _bmad-output/specs/spec-done-stop-leaves-the-round/when-step.md
- research — _bmad-output/planning-artifacts/research/domain-captain-food-pitch-2026-09-30/research.md, section 5
- constraint — docs/api.md, Conventions (additive sync changes)

## Notes

- Decision: this epic's server changes (a visits column, a prospects column, an optional sync field, admin filter params) sit outside the initiative's server-gaps.md G1–G8 rule, approved by the owner (2026-09-30).
- Decision: CAP-4 is the Visites ledger only. The admin side has no view of one prospect's visit history, and the spec was corrected (2026-09-30).
- Decision: the Hors cible flag clears through a new nullable `prospects.out_of_target_reviewed_at`, stamped only by a direct admin PATCH. `updated_at` is not used because assign, merge and CSV import also change it (`admin.ts:709,758,978,1158`) (2026-09-30).
- Decision: entry 1 is the tracer bullet: the contract and the storage. After it, 2 (field) and 3 (admin) run in parallel. 4 waits on 3 because both edit `src/worker/routes/admin.ts` and `docs/api.md` (2026-09-30).
- Assumption: "Sans raison" in the Visites filter means Pas intéressé visits with a null reason, not every visit.
- Waits on epic-admin-screens because: the rebuilt Visites ledger (3.4) and Prospects filter bar (3.5). Both are merged.
- Waits on epic-field-screens because: step 2 with the when step (4.14), which is merged.
