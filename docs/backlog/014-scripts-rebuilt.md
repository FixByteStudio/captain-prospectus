---
id: 014
status: ready
implements: _bmad-output/initiative-dashboard-redesign/epic-admin-screens/story-scripts-rebuilt.md (#184), EXPERIENCE.md § Component Patterns, docs/design.md#the-script-editor
depends_on: []
---

# Scripts rebuilt (#184)

## Goal

The script editor runs on the admin primitives like the five screens already
rebuilt in epic #174 (Visites, Prospects, Import, Doublons, À rattacher), with
question cards, and every current behaviour kept.

## Acceptance criteria

- [ ] Each question is a card. Its `GripVertical` handle is the only way to drag it.
- [ ] Questions reorder from the keyboard through dnd-kit's `KeyboardSensor`; a DOM test pins it.
- [ ] A saved key is locked. Only « Modifier la clé » unlocks it, and a standing warning (not a toast) stays visible while it is unlocked; a DOM test pins lock, unlock and the warning.
- [ ] The versions rail is read-only.
- [ ] One primary action opens a confirmation dialog that names the version it will create; a DOM test pins the name.
- [ ] While the save is in flight the button shows a spinner and is disabled until the server answers.
- [ ] The effect that seeds the form once still stops a background refetch from overwriting an edit in progress; a test pins it.
- [ ] #72 fixed: at 390px the screen is no wider than the viewport (no horizontal scrollbar).
- [ ] `docs/design.md` § The script editor is rewritten for cards. Epic #174's inception settled it: cards win over "no steps, no cards".
- [ ] Every French string is in `src/client/copy.ts`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:precache` green; the PR quotes the precache total against 1,000 KiB.
- [ ] The PR body says `Closes #184` and `Closes #72`.

## Out of scope

- Any change to the scripts API or the versioning rules.
- The six-screen check on real devices (backlog 015, #185).
- Cleanup across the epic (backlog 016, #186).

## Notes

- Before starting, check that À rattacher (#183) is on `main`: its rebuild is in `src/client/admin/`. If it is not, the task is blocked. Go to step 8 of the skill.
- Follow the pattern of the other rebuilt screens. Screen code is in `src/client/admin/scripts/`.
- Stitch references: `_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/a11_scripts` and `a12_scripts_dialogue_de_confirmation`.
- Neither ScriptsScreen nor QuestionRow has a DOM test today. These are the first.
