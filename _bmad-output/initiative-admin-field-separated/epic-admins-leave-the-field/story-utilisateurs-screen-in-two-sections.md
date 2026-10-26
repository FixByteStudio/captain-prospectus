---
tracker_id: "594"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/594"
tracker_status: done
id: 6
type: story
title: "Utilisateurs screen in tabs"
parent: epic-admins-leave-the-field
covers: [R8]
after: [5]
hitl: true
risk: low
---

# Utilisateurs screen in tabs

## Description

Turns the Agents screen into Utilisateurs at /admin/users, after the owner approves its mockup, listing Agents and Administrateurs in two tabs (first built as two sections, amended to tabs by the owner on 2026-10-21, #607) with the role chosen once in Ajouter un utilisateur, and updates docs/design.md and docs/glossary.md; delivers R8 and what epic 3 needs from this epic.

## Acceptance Criteria

Verify: A screen test shows the two tabs with no role toggle, the dev server's /admin/users matches the approved mockup, and the PR quotes the precache total.

## References

- parent — _bmad-output/initiative-admin-field-separated/epic-admins-leave-the-field/epic-admins-leave-the-field.md

## Notes

- Open question: The sections' layout on a phone and on a desktop, settled by the mockup.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->

Built from `_bmad-output/implementation-artifacts/spec-gh-594-utilisateurs-screen-in-two-sections.md`; mockup approved 2026-10-20 (`mockup-utilisateurs-screen.png`): Agents then Administrateurs, a Désactivés toggle per section, the add dialog unchanged.
