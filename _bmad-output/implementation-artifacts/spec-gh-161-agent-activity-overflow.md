---
title: 'Activité par agent fits its 3:2 card at 1280 px'
type: 'bugfix'
created: '2026-09-29'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: 'b984d5cbba7fba6635bf1637b568775347ea04cb'
context: ['{project-root}/docs/design.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** GH #161. At 1280 px the Activité par agent table overflows its 3:2 card, so Prospects ouverts sits behind a sideways scroll. docs/design.md › Tableau de bord says the 3:2 split is there "so the five columns fit at 1280 px", and the table scrolls sideways only at 390 px. The agent cell is `whitespace-nowrap`, so the email sets the column's width. The seed's short `admin@example.com` fits with 6 px to spare, but a real-length email (`lea.vandenbroeck@captain-prospectus.be`) makes the table 696 px wide in a 575 px container when a classic scrollbar is showing.

**Approach:** The agent column takes the width the four figure columns leave, and the email truncates with an ellipsis. The full address stays in a `title` and in the accessible text. A minimum width on the agent cell keeps the table scrolling sideways at 390 px instead of crushing the email. Tailwind utilities and spacing-scale tokens only, in `AgentActivityTable.tsx`.

</frozen-after-approval>

## Implementation Notes

Oneshot: one component, a few class changes, no data or API impact. Measured with Playwright against `pnpm dev` on the seed, with the dashboard response rewritten in the browser to use real-length emails and 10× visit counts, with and without a classic scrollbar.

- Cause: the agent cell is `whitespace-nowrap`, so the email sets the column. The seed's `admin@example.com` fits with 6 px to spare, which is why it did not reproduce on the seed. With real-length emails the table was 696 px in a 575 px container (classic scrollbar, 1280 px).
- Fix, in `AgentActivityTable.tsx` only: at ≥ lg the agent cell is `w-full max-w-0 min-w-40`, and the email span is `truncate` with `title={a.email}`. Below lg nothing changes, so the email shows whole and the table scrolls at 390 px as before.
- First try (spotted in review, see triage): the rule applied at every width and put `min-w` on the inner span. `max-w-0` then cancelled that minimum (the column fell to 70 px at 390), and phones truncated emails they used to scroll to.
- 1024 px is lg but narrower than the design's 1280 promise. The figures alone need ~375 px there, so the `min-w-40` floor makes the card scroll instead of collapsing the email to its initial.
- `docs/design.md` › Activité par agent gains one line on the lg truncation.
- Final measurements (Chromium, classic scrollbar, long emails): 1280 → table 575 in 575; 1024 → 536 in 421, agent column 160; 820 → fits, full email; 390 → scrolls, full email. The seed data gives the same results, and light and dark are identical.

## Spec Change Log

## Review Triage Log

Quick lens, one pass: 3 real (patched), 1 maybe-false (deferred).
- medium, patch — phones truncated the email with no way to read it (`title` does not show on touch). Truncation is now lg-only; at 390 the full email is back and the table scrolls sideways.
- low, patch — `w-full` at every width squeezed the figure columns, so their heads wrapped at 820 px (measured [86,115,123,195] → [75,100,96,104]). The lg-only scope restores 820: [84,112,121,191].
- maybe-false, deferred — `min-width` and `max-width` on a table cell, and how they interact across engines. Measured in Chromium only. If Firefox or WebKit ignore the floor, the agent column collapses at 1024–1210 px. Checking the dashboard in Firefox and Safari at 1024 would settle it.
- medium, patch — docs/design.md did not describe the truncation; it now does in one line (Definition of done).

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass

**Manual checks:**
- At 1280 px (classic scrollbar, long emails): table scrollWidth ≤ container clientWidth, email ellipsised. At 820 px: fits. At 390 px: the table scrolls sideways inside the card with the email still readable (not collapsed). Light and dark.
