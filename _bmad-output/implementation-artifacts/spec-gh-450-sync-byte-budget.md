---
title: 'Bound the phone sync batch by bytes, not only by count'
type: 'bugfix'
created: '2026-10-18'
status: 'done'
baseline_commit: '310dd56fdffbd7a10883d1aa41c970c8f3046516'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/docs/free-tier-budget.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `SYNC_VISITS_PER_BATCH` (50) bounds how many visits a phone sends per pass, not how many bytes. 50 visits with full notes and answers come to 1.7 MB and run past 10 ms of Worker CPU warm (GH #450, PR #563). The only byte bound today is the server's `MAX_REQUEST_BYTES` (2 MiB), and `PAYLOAD=max` at that size is over too.

**Approach:** Measure `PAYLOAD=full` over a range of `SIZES` with `node --expose-gc scripts/measure-sync-cpu.mjs`, and pick the byte budget per pass that keeps a sync under ~6 ms warm worst. Add it as a client-side constant and make `serializeWithinCap` (`src/client/field/sync.ts`) fill each pass up to it. Record the figures in `docs/free-tier-budget.md`. The server's `MAX_REQUEST_BYTES` drops only if the numbers require it; if it does, that is a contract change and both client versions rise. A single visit over the budget is still sent alone (INVARIANT 5). Closes #450.

</frozen-after-approval>

## Implementation Notes

Oneshot: roughly 70 lines of code (one constant, the trimming function, its tests, the script's GC protocol) plus the doc entry.

**Measured before planning** (Ryzen 9 7900, local seed, session-authenticated, `PAYLOAD=full`, 3 rounds × 50 warm runs):

- `--expose-gc` as PR #563 used it (a full `gc()` before each timed request) adds a fixed ~3.5 ms to *every* request. With it, bare visits at 1 / 50 come to 5.1 / 8.3 ms median, against 1.5 / 3.0 ms without. A full mark-compact leaves the next request cold. So "still over 10 ms with GC taken out" is an artefact of the harness. A minor GC (`gc({ type: "minor" })`) clears the earlier requests' young garbage and matches the no-GC medians (1.8 / 3.4 ms).
- Minor GC, two runs: 1 visit (33 KiB) 1.7–1.8 median, p95 2.4–2.8. 5 (167 KiB) 2.3–2.5 / 3.3–3.6. 8 (268 KiB) 2.7–2.8 / 4.1–4.3. 10 (335 KiB) 3.1–3.3 / 4.5–4.9. 15 (502 KiB) 3.8–3.9 / 5.2–5.6. 20 (669 KiB) 4.5–4.7 / 6.3–6.5. 30 (1,004 KiB) 6.0 / 8.0. 50 (1,673 KiB) 8.7–8.8 / 46–49. The max column has sporadic 10–30 ms spikes from about 5 visits up: major GCs of the old and large-object space.
- Settle protocol (full GC, then one untimed request of the same size, then a minor GC, then the timed one): max 4.8 at 5, 5.4 at 10, **6.0 at 15 (502 KiB)**, 8.7 at 20, 11.2 at 30, 51 at 50.

**Decision:** `SYNC_BYTES_PER_BATCH = 393_216` (384 KiB), revised from 512 KiB after a second pass: 15 visits (502 KiB) peaked at 6.2–7.2 ms with `SETTLE=1`, 12 (402 KiB) at 6.1–7.1, 11 (368 KiB) at 5.3–5.4. 384 KiB is 11 full visits and 3 `max` visits. `MAX_REQUEST_BYTES` stays 2 MiB: one worst-case visit is ~105 KiB and fits the budget, so the server cap never binds a current phone; no contract change, no version bump. Old builds' passes keep their cost, as today.

**Trimming:** replace the halving with an exact prefix. JSON-serialize the envelope with `visits: []`, add each visit's UTF-8 bytes plus a comma, and stop before the first visit that would go over. The first visit is always taken. Halving would send 12 heavy visits where 15 fit. Common case: one stringify, unchanged.

**Script:** under `--expose-gc` the GC before each timed request becomes a minor one. `SETTLE=1` adds the settle protocol to warm runs only, so the cold column stays a cold request.

**Drain:** `MAX_DRAIN_PASSES` (24) is derived from the count, so 1,200 heavy visits (15 a pass) need more than one trigger. The rest drains on the next heartbeat. That is acceptable and documented, not changed.

**Not fixed here:** the morning pass (100 field prospects + 200-stop swipe) is 9–14 ms even with one visit, so bytes are not its lever (GH #449). Not measured twice: `max` and the morning pass have one run each at the final budget; bare `SETTLE=1` was not run.

**Review (quick, by the orchestrator, no subagent):** `serializeWithinCap` edge cases walked: zero visits, one oversized first visit (sent alone), exact-fit boundary (`total > budget` breaks, equal fits), payloads with `position` undefined (stripped identically in both stringifies). No findings. Baseline `310dd56` equals the merge-base with the default branch; `git diff 310dd56 -- src/worker src/shared/schemas.ts` is empty.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass
- `D1_SQLITE=… GC=… node --expose-gc scripts/measure-sync-cpu.mjs` with `PAYLOAD=full SIZES=1,5,10,15,20,30,50`, with and without `SETTLE=1` -- expected: exit 0, figures as in the doc
- `git diff origin/main -- src/worker src/shared/schemas.ts` -- expected: empty (no server or contract change)

**Merge with main (2026-10-19):** main took #451 (server accepts at most 50 visits, `CLIENT_VERSION` 3), #449 (field-prospect insert ~4 → ~1.5 ms) and #571 (cold-request warmup in the script). Conflicts were docs plus `constants.test.ts`, where `SYNC_VISITS_PER_REQUEST` is gone; the byte-budget test moved to its own `describe`. The morning pass was re-measured on the merged code: 6.3–7.8 ms median (minor GC), 9.0–10.4 ms (`SETTLE=1`, one run), worst 11–15 ms; filed as #577 (found in passing), since bytes are not its lever. The `SETTLE=1` second run of the morning pass and an 11-visit confirmation run were cut off by the 10-minute limit and not repeated.
