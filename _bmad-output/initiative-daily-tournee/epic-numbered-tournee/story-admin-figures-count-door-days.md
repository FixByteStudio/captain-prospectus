---
tracker_id: "506"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/506"
tracker_status: done
id: 10
type: story
title: "Admin figures count door-days"
parent: epic-numbered-tournee
covers: [R12, R16]
after: [2]
risk: medium
---

# Admin figures count door-days

## Description

Entry 2's door-day reader (the latest visit per agent, prospect and Brussels day) feeds « Visites », the visits-by-day chart, « Activité par agent », flyers, refusal reasons, conversions and the recap card's visit count. docs/api.md › The dashboard and The recap card follow.

## Acceptance Criteria

Verify: Worker tests: Personne sur place at 10:00 and Converti at 16:00 on one door count as 1 visit and 1 conversion, and the chart shows only the conversion. A flyer on the first visit counts the door-day once. A refusal reason counts only from the latest visit, and « Activité par agent » and the recap card count the door 1.

## References

- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md

## Notes

- Open question: Whether the grouped reads stay inside the 10 ms CPU budget at a season's volume.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
