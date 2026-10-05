---
tracker_id: "247"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/247"
tracker_status: done
id: 1
type: story
title: "Refusal reasons in the contract and the database"
parent: epic-refusal-reasons
covers: [CAP-2, CAP-3, CAP-6]
risk: low
---

# Refusal reasons in the contract and the database

## Description

Adds REFUSAL_REASONS to src/shared/constants.ts, an optional refusalReason in visitSchema (zod/mini), and a nullable visits.refusal_reason column plus prospects.out_of_target_reviewed_at through pnpm db:generate (expand only). The sync stores the reason only for not_interested and null otherwise, and never refuses a visit over it. It also adds REFUSAL_REASON_LABELS in src/client/copy/shared.ts, re-exported by copy/field.ts like the outcome labels, a 7-row value/label table under 'Refusal reason' in docs/glossary.md, the list and the rule in docs/domains/prospecting.md, and updates docs/api.md and docs/data-model.md. Entries 2, 3 and 4 build on these constants, labels and columns.

## Acceptance Criteria

Verify: Worker tests show a not_interested visit stores its reason, while a visit with no reason and one with a reason on another outcome are both accepted with null. not_interested derives rejected and the other outcomes keep their OUTCOME_TO_STATUS status. The migration applies with pnpm db:migrate:local, and the PR quotes the precache total against 1,000 KiB because copy/shared.ts reaches the field bundle.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-refusal-reasons/epic-refusal-reasons.md
- _bmad-output/specs/spec-not-interested-skips-script/refusal-reasons.md
- docs/api.md, Conventions

## Notes

- Open question: None known.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
