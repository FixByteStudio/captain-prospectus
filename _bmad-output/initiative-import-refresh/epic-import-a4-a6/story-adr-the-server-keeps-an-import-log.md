---
tracker_id: "366"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/366"
tracker_status: backlog
id: 3
type: story
title: "ADR: the server keeps an import log"
parent: epic-import-a4-a6
covers: [R3]
hitl: true
risk: medium
refined: true
---

# ADR: the server keeps an import log

## Description

An ADR, written with the new-adr skill, decides how the server records an import. It settles:
- what groups the 250-row batches into one import;
- what a log row stores: source, file name or zone summary, created and updated counts, the rejected count the client sends (rejected rows never reach the server), the admin and timestamps;
- how a retried or re-sent batch is counted once (invariant 4);
- when an import reads « Terminé », « Interrompu », or neither while batches are still arriving;
- retention, since a row names an admin (as ADR-0023 does for visits);
- the glossary term, and the additive field on POST /api/admin/prospects/batch.

The person's step: the owner reviews the ADR and accepts it.

## Acceptance Criteria

Verify: The ADR is merged as Accepted. It names the table, the batch request field, the read route, the rule that counts a re-sent batch once, and the rule for « Interrompu », which entries 7 and 8 build.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md
- api — docs/api.md, the POST /api/admin/prospects/batch row
- adr — docs/adr/0023-retention-by-redaction.md
- domain — docs/domains/ingestion.md, section CSV import

## Notes

- Open question: Whether « Interrompu » can be known server-side without a closing call from the client — for example the client sends the batch count up front and the server compares what arrived after a timeout.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
