---
title: 'Split copy.ts by audience so the field precache drops admin strings (GH #20)'
type: 'refactor'
created: '2026-09-28'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: []
baseline_commit: 'e26ae890ba4f9d9a673e6dcd1aefb2391a9379f9'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `src/client/copy.ts` is one `copy` object, so every admin screen's French strings sit
in the shared `constants-*.js` chunk the field route precaches. Measured on the baseline: removing
the admin sections drops the precache from **939.26 to 923.64 KiB** (−15.6 KiB raw, ~5.5 kB
gzipped) against the 1,000 KiB ceiling (ADR-0026), and the cost grows with every admin screen.

**Approach:** Split the strings by audience into `copy/shared.ts`, `copy/field.ts` and
`copy/admin.ts`. `copy/field.ts` exports a `copy` object of shared + field sections; every module
outside `src/client/admin/` imports that. `copy.ts` stays the full aggregator the admin side keeps
importing, so admin call sites and `copy.x.y` expressions are unchanged. `check:precache` fails
when `copy/admin.ts` reaches a precached chunk.

## Boundaries & Constraints

**Always:** Every French string still lives under `src/client/copy*` (INVARIANT 15). Call sites
keep `copy.<section>.<key>`; only import paths change. Strings move byte-for-byte — no wording edits.
Label maps (`OUTCOME_LABELS`, `OUTCOME_HINTS`, `STATUS_LABELS`, `SOURCE_LABELS`,
`QUESTION_TYPE_LABELS`, `TYPE_LABELS`) live in `copy/shared.ts` and stay importable from both paths.

**Never:** No i18n library, no lookup function, no renamed keys or sections. No edits to test
files beyond what a failing typecheck forces. No change to admin import sites.

</frozen-after-approval>

## Code Map

- `src/client/copy.ts` -- today: `PAGER` (admin-only helper), `copy` object (lines 30–893), label maps (895–953). Imports `formatCount`, `formatRadiusKm` from `./format` and enum types from `../shared/constants`.
- Sections by audience (from usage grep):
  - **shared**: top-level `appName`, `close`, `breadcrumbMore`, `breadcrumb`, `spinner`, `attribution`; `nav`, `errors`, and `palette` (a vendored `ui/command.tsx` string, grouped with the other vendored-component strings so all of `ui/` imports one path).
  - **field**: `carte`, `today`, `visit`, `fieldProspect`, `sync`, `update`.
  - **admin**: `search`, `notifications`, `theme`, `account`, `dashboard`, `prospects`, `import`, `map`, `visits`, `orphans`, `duplicates`, `scripts` (+ `PAGER`).
  - Admin reads `copy.fieldProspect` once — fine, the aggregator holds everything.
- Non-admin importers to repoint (all `import { copy[, LABELS] } from "../copy" | "./copy" | "@/copy"`): every non-test file in `src/client/field/`, `src/client/App.tsx`, `src/client/Band.tsx`, and `src/client/ui/{dialog,sheet,command,sidebar,breadcrumb,spinner}.tsx`.
- `scripts/check-precache.mjs` -- `ADMIN_ONLY` list + `isAdminOnly` match exact names from `dist/client-chunk-modules.json`, where source modules appear as `src/client/...` paths. Add `src/client/copy/admin.ts` there.
- `scripts/check-precache.test.mjs` -- leak tests at ~:221–270 to mirror for the module case.
- Docs naming "one file `copy.ts`": `CLAUDE.md:41` (INVARIANT 15), `docs/adr/0013-frontend-conventions.md:19-20,40-41`, `docs/glossary.md:7`. Leave `docs/vision.md`'s dated measurements alone (historical).
- Do not touch: test files (they import the full `copy.ts`, a superset), `src/client/admin/**`.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/copy/shared.ts` -- new: header comment, `sharedCopy` (shared sections, `as const`) and the six label maps with their doc comments -- one home for strings both sides render.
- [x] `src/client/copy/field.ts` -- new: field sections, then `export const copy = { ...sharedCopy, ...<field sections> } as const` and re-export the label maps; comment says non-admin modules import this path and why (GH #20).
- [x] `src/client/copy/admin.ts` -- new: `PAGER` and `adminCopy` (admin sections, `as const`), carrying its `format` imports.
- [x] `src/client/copy.ts` -- reduce to header + `export const copy = { ...fieldRouteCopy, ...adminCopy } as const` + `export * from` label maps; header says admin imports this, everything else `copy/field`.
- [x] Non-admin importers listed in the Code Map -- repoint to `copy/field` (relative, or `@/copy/field` in `ui/`).
- [x] `scripts/check-precache.mjs` -- add `src/client/copy/admin.ts` to the leak list with a one-line why.
- [x] `scripts/check-precache.test.mjs` -- add a case: precached chunk holding `src/client/copy/admin.ts` exits non-zero naming it.
- [x] `CLAUDE.md`, ADR-0013, glossary -- one-line wording: strings live in `copy.ts` and the `copy/` modules it re-exports; field-reachable modules import `copy/field`.

**Acceptance Criteria:**
- Given a build, when `pnpm check:precache` runs, then it passes and the total is ≤ 925 KiB (baseline 939.26), and no precached chunk lists `src/client/copy/admin.ts` or `src/client/copy.ts`.
- Given the `AdminApp` chunk, when inspecting the chunk-module map, then it holds `src/client/copy/admin.ts`.
- Given a field module reverted to `import … from "../copy"`, when building, then `check:precache` fails naming `src/client/copy/admin.ts`.
- Given the change, when `pnpm typecheck`, `pnpm test`, `pnpm lint` run, then all pass.

## Design Notes

Spreads of `as const` objects keep readonly literal types, so `copy` from either path types exactly
like today's. Rolldown drops a module no chunk imports, so the saving comes from import graph shape,
not property-level tree-shaking — that is why the guard checks the module, not string contents.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all pass.
- `pnpm build && pnpm check:precache` -- expected: pass, total ≤ 925 KiB; quote the number in the PR.
- `grep -rlE 'from "(\./|\.\./)+copy"|from "@/copy"' src/client --include=*.tsx --include=*.ts | grep -v '^src/client/admin/' | grep -v '\.test\.'` -- expected: empty.

## Implementation Notes

- Precache after the split: **923.79 KiB** (25 entries), down from 939.26. `copy/admin.ts` and `copy.ts` sit only in `AdminApp-*.js`; `copy/field.ts` + `copy/shared.ts` in `constants-*.js`.
- Negative check done: reverting `field/BackLink.tsx` to `../copy` made `check:precache` fail with `"assets/form-*.js" holds admin-only src/client/copy/admin.ts`.
- `copy.ts` uses `export * from "./copy/shared"`, so it also exports `sharedCopy` beside the label maps; harmless, no caller uses it.

## Spec Change Log

## Review Triage Log

**Pass 1** (blind-hunter, edge-case-hunter, verification-gap, intent-alignment) — high 0 · medium 0 · low 5 · false 0 · rejected-by-rule 6 · verification-gap: no gaps.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | Admin-leaning strings (`nav` admin labels, `palette`, `breadcrumb*`, `errors.sessionExpired`, `STATUS/SOURCE/QUESTION_TYPE_LABELS`) still ship via `copy/shared.ts` | low | reject | Real, ~1–2 KiB. The frozen intent routes every module outside `admin/` (incl. `ui/sidebar`, `ui/command`, `ui/breadcrumb`) through `copy/field`, and Boundaries put the label maps in shared; a narrower split would renegotiate intent, not patch it. |
| 2 | Rule stated two ways: `copy/field.ts` says "outside `src/client/admin/`", CLAUDE.md/ADR-0013/glossary say "field-reachable" | low | defer | Real wording drift from this spec's Tasks line; the fix edits CLAUDE.md, an agent-context file → deferred for the owner. |
| 3 | Shallow spread in `copy.ts` lets a future admin key silently shadow a shared/field one | low | reject | No top-level keys overlap today (verified by verification-gap lens); a shadowing `nav`/`errors` would also break admin call sites' types. Fix adds a type-level guard for an unlikely edit. |
| 4 | Leak message advises "move behind lazy AdminApp" for a copy leak; list/docblock say packages only | low | patch | Direct text correction in `scripts/check-precache.mjs`. |
| 5 | `src/client/copy.ts` aggregator not in the leak list though the AC names it | low | patch | AC: "no precached chunk lists … `src/client/copy.ts`"; enforced only indirectly today. One-line list entry + test case. |
| 6 | No ESLint `no-restricted-imports` to catch a bad import before build | low | reject | `check:precache` in CI already fails the leak (negative check done); a lint rule is an extra guard. |
| 7 | Field/App tests still import the `../copy` aggregator | low | reject | Spec Never forbids test edits; values are identical and typecheck pins keys. No wrong outcome. |
| 8 | No before/after figure; `docs/vision.md:102-105` says `copy.ts` is one object | false | reject | Figures are in Implementation Notes and go in the PR; vision.md's paragraph is a dated measurement log, not current guidance. |
| 9 | `.claude/agents/pwa-engineer.md:22`, `.claude/skills/night-shift/SKILL.md:66` and several ADR/design lines still point field authors at `copy.ts` | low | defer | Agent-context files → deferred. A wrong import is still caught by `check:precache`. |
| 10 | Regression tests use a synthetic fixture only | low | reject | The real graph is checked by `check:precache` on every CI build; the fixture tests the matcher, which is its job. |
| 11 | ADR-0013 edited line exceeds the 100-column wrap | low | patch | Direct rewrap. |
