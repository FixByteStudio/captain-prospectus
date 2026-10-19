---
tracker_id: "581"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/581"
tracker_status: backlog
id: 1
type: story
title: "Rename every client route slug to English"
parent: epic-english-slugs
covers: [R1]
risk: low
---

# Rename every client route slug to English

## Description

Renames the ten route slugs listed in R1 in App.tsx, AdminApp.tsx and nav.ts, every navigate, Link and NavLink target and helper such as visitPath, the tests that pin them, and every doc that quotes an old path, and adds a slug column to the glossary's screen rows; no redirect from the old paths.

## Acceptance Criteria

Verify: A grep of src and docs (backlog files with status done excepted) for the route paths /tournee, /admin/agents (not /api/admin/agents), /admin/doublons, /admin/visites, /admin/a-rattacher and /admin/tournee finds no route path, every field tab and admin nav entry opens its screen in the dev server, and pnpm lint, typecheck, test, build and check:precache pass with the precache total quoted in the PR.

## References

- parent — _bmad-output/initiative-admin-field-separated/epic-english-slugs/epic-english-slugs.md

## Notes

- Open question: Which done backlog files and ADRs quote an old path as history and should keep it; vite.config.ts names no field path (start_url /, navigateFallback index.html).

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
