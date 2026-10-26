---
title: 'The process lines the retros keep asking for are written down once'
type: 'chore'
created: '2026-10-26'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: [quick]
review_loop_iteration: 0
baseline_commit: 'c5809c92e416adf5c94b22ecbfeb5c8c03dc9fc5'
context:
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Five process rules (CAP-19: #579 actions 6 and 7, #580 actions 9 and 10, #538 action 10) have been asked for in three retros and are still unwritten, and `release-checklist` line 11 asks for a CodeRabbit review that no PR gets.

**Approach:** Write each rule once, in the file that owns it: `CLAUDE.md` (`Refs` on `hitl`, push command), `release-checklist` (line 11, reworded to what the repo can meet), the `bmad-build` team override (bot comments listed before "ready to merge", midnight-crossing skew), `d1-migration` and `docs/deployment.md` (failed unique-index migration, fresh redeploy). Do not touch `.github/pull_request_template.md` (#637 owns it). Line 11 is reworded, not backed, because CodeRabbit skipped 29 of the last 30 PRs with « fewer than 10 stars » and the 30th with « Bot user detected ».

</frozen-after-approval>

## Implementation Notes

Oneshot: documentation only, about 30 lines in six files. The `bmad-build` skill is vendored under `.agents/skills/` and would lose an edit on update, so its two lines go in `_bmad/custom/bmad-build.toml`, the committed team override that already carries the `baseline_commit` policy.

## Verification

**Commands:**
- `grep -n -E "Refs #n|push -u origin HEAD" CLAUDE.md` -- expected: both rules found
- `grep -n "fewer than 10 stars" .claude/skills/release-checklist/SKILL.md` -- expected: reworded line 11
- `grep -n -E "ready to merge|midnight" _bmad/custom/bmad-build.toml` -- expected: both rules found
- `grep -n -i "unique" .claude/skills/d1-migration/SKILL.md docs/deployment.md` -- expected: both name the fresh redeploy
- `pnpm lint` -- expected: passes

## Review Triage Log

- medium, patched: release-checklist line 11 covered only « fewer than 10 stars »; #651 got « Bot user detected ». Reworded to any « skipped » notice.
- medium, patched: the bot-comment rule named only inline comments; it now names the review bodies and issue comment too, and `--paginate`. The extra « never merge » clause was dropped as out of scope.
- low, patched: file header of `_bmad/custom/bmad-build.toml` named only the #59 actions.
- low, rejected: `d1-migration` and `docs/deployment.md` both carry the unique-index rule. The story asks for both; the skill links to the doc.
- low, kept: `Refs`/push lines sit under « Definition of done »; no better home in CLAUDE.md. `.github/pull_request_template.md` still says `Closes #` until #637; named in the PR.
