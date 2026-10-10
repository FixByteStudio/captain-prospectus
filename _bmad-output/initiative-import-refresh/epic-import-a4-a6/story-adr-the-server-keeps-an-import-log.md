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
---

# ADR: the server keeps an import log

## Description

An ADR (new-adr skill) decides how the server records an import: what groups the 250-row batches into one import, what a log row stores (source, file name or zone summary, created and updated counts, the rejected count the client sends since rejected rows never reach the server, the admin, timestamps), how a retry or re-sent batch avoids counting twice (invariant 4), when an import reads « Interrompu », retention, the glossary term, and the additive change to POST /api/admin/prospects/batch; the owner accepts it.

## Acceptance Criteria

Verify: The ADR is merged as Accepted and names the table, the request field and the read route that entries 7 and 8 build.

## References

- parent — _bmad-output/initiative-import-refresh/epic-import-a4-a6/epic-import-a4-a6.md

## Notes

- Open question: Whether « Interrompu » can be known server-side without a closing call from the client.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
