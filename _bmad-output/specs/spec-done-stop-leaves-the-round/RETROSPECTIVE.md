---
date: 2026-09-30
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# Retrospective: A visited stop leaves the round

## Epic summary

- **Scope.** Focused, stories mode. This spec folder covers two stories of epic #117:
  - #238: `interested` becomes a closed status. Range `16662e7..0e1e080` (spec `spec-gh-238-interested-closed-status.md`, `status: done`).
  - #239: a visited stop leaves the round. Range `0e1e080..db0c866` (spec `spec-gh-239-visited-stop-leaves-the-round.md`, `status: done`, PR #242 merged 2026-09-30).
- **Narrowed scope, chosen by the owner.** The folder has no `stories.yaml` and the repo has no `sprint-status.yaml`, so the story list was taken from the ticket file (`epic-field-screens/tickets.toml`, entries 13 and 14). No `pending_stories` check ran. Epic #117 as a whole is still unfinished (entry 15 has not started) and is not judged here.
- **Owner's going-in concern.** On À relancer, step 2 still asks the script's questions and they are required. If À relancer means the owner of the restaurant was busy or not there, an agent who cannot move on without answers will make them up.
- **Evidence available:**
  - `SPEC.md`, `round-placement.md`, `when-step.md`, `.memlog.md`;
  - the forge brief `_bmad-output/forge/done-stop-leaves-the-round/forged-idea.md`;
  - both story specs, including their review triage logs;
  - git history.
- **Evidence missing:**
  - Session logs for the forge and spec sessions. What was said beyond `.memlog.md` is unknown.
  - The #239 build session is this conversation.

## Findings

### F1: required answers on À relancer rest on an assumption nobody wrote down (fix now)

- **The rule.** `docs/domains/field-operations.md` says "Required questions of the active script must be answered unless the outcome is `no_contact`." It has stood unchanged since the foundations commit `c1c7cf4` (2026-09-21).
- **Why no_contact is exempt.** The implementing commit `791b31d` gives the reason: "waives required answers for no_contact, because nobody was there to ask." The code comment in `src/client/field/visit-draft.ts` still says the same.
- **The gap.** The rule assumes that every other result means someone was there to answer. For À relancer, the owner says that is false: the owner may be busy or absent. Staff at the counter cannot answer questions meant for the decision-maker.
- **As built on main (`db0c866`).**
  - On À relancer, step 2 shows the required questions and, below them, a required when choice (`when-step.md` › Placement, `src/client/field/VisitScreen.tsx`).
  - A blocked save focuses the first unanswered question (test "an unanswered question above the radios wins the focus", `VisitScreen.test.tsx`).
  - The agent's only way through is to answer.
- **Harm.** Made-up answers get stored in `visits.answers` as if the prospect had given them. Nothing is deployed yet, so no real data is affected so far.

### F2: À relancer and Personne sur place have no definition (fix now)

- `docs/glossary.md:45,52` maps `follow_up` to "À relancer" and gives no meaning.
- This spec's CAP-4 defined Intéressé and Converti (`SPEC.md`), but not the two results that share the when step.
- The only descriptions agents see are the hints in `src/client/copy/shared.ts`:
  - Personne sur place: "Fermé ou personne pour répondre. On repassera."
  - À relancer: "Un rendez-vous à reprendre." (hint introduced in `a16622a`, #123). This reads as though a conversation happened, which contradicts the owner's meaning.
- Where the two results overlap is undefined. "Personne pour répondre" (Personne sur place) and "the owner is not there" (À relancer, per the owner) describe nearly the same door.

### F3: the spec asked about the questions for one result and not the other (process lesson)

- The spec asked the owner whether hiding the questions on Personne sur place loses data (`.memlog.md`, question and "Owner answer Q2").
- The same question was never asked for À relancer.
- The forge brief settled À relancer as layout only: "its script questions stay above the radios" (`forged-idea.md` › Decisions). `when-step.md:7` then carried that line into the contract.
- The spec changed what step 2 asks for each result without asking, for each result, who is at the door to answer.

### F4: build and review could not catch it (accept as-is, process lesson)

- `spec-gh-239` copied `when-step.md` exactly, as it should.
- The four review lenses (blind hunter, edge case hunter, verification gap, intent alignment; see `spec-gh-239` › Review Triage Log) judge the diff against the spec and its intent. The intent auditor was given the spec's Intent section only.
- No lens checks a requirement against the domain meaning of a result, so a wrong requirement passes cleanly.
- The lenses worked as designed. The catch belongs at spec time (F3).

### F5: the agent supplied a rationale no artifact records (process lesson)

- When the owner asked why À relancer keeps the questions, the build agent answered that "À relancer means the agent spoke to someone". It presented this as the reason for the design.
- No artifact says this. `.memlog.md` records only the placement decision.
- It was corrected in the same session, but an unrecorded rationale stated as fact is exactly how F1's assumption survives.
- Source: the #239 build session (this conversation).

## Behaviour verification

- **Not exercised in a browser in this retro.** The as-built behaviour in F1 is established from code and tests on main:
  - `toVisit` validates answers for every outcome but `no_contact` (`visit-draft.ts`);
  - the step-2 tests in `VisitScreen.test.tsx` ("step 2, À relancer: …").
- Those tests passed in the #239 verification (2015/2015).

## Previous-retro follow-through

- The prior retro is `epic-117-retro-2026-09-29.md`. Action items 1–3 were answered by this spec and its two stories:
  1. The spec itself: this folder.
  2. Docs reconciliation: `db0c866`, `docs/design.md`, `docs/domains/field-operations.md`, `EXPERIENCE.md`, `DESIGN.md`, `spec-gh-118`.
  3. Remediation: `db0c866`, `today.ts`, `progress.ts`, `TodayScreen.test.tsx`.
- There is no `sprint-status.yaml`, so no action-item status exists to update.

## Action items

All of these are proposed. Nothing has been applied.

1. **Define À relancer and Personne sur place by what happened at the door and who could answer.** Also say where the line between the two falls. Owner: m0hss (decision). Then add the definitions to `docs/glossary.md` and `docs/domains/prospecting.md`, and align the phone hints.
2. **Reconcile the rule** (spec change). Once item 1 is decided:
   - amend `field-operations.md` › "Required questions … unless `no_contact`";
   - amend `when-step.md` › Placement for À relancer: questions hidden like Personne sur place, or shown but optional;
   - apply the change through `bmad-spec` on this folder.
   Owner: m0hss.
3. **Remediation story** (dev loop, after item 2). Covers:
   - `toVisit`'s answer requirement for `follow_up`;
   - À relancer's step 2 in `VisitScreen.tsx`;
   - the save sheet's answer count;
   - the tests pinning required answers on À relancer;
   - the À relancer hint.
   Owner: the next `bmad-build` run.
4. **Spec-time check** (process). When a spec changes what a visit asks, it states for each result who is at the door to answer, and asks the owner about every result it touches, not only one. Owner: m0hss, via `bmad-spec` usage or `bmad-project-context`.
5. **Agent pitfall** (process). When a decision's reason isn't in the spec or memlog, the agent says "not recorded" instead of supplying one. Owner: m0hss, via `bmad-project-context` (records observed agent mistakes as pitfalls).

## Acceptance verdict

**Machine verdict: accepted-with-open-items.** Criteria: declared (`SPEC.md` CAP-1 to CAP-5 and the Success signal).

- **Criteria met.** Both stories are done and merged, and their verification shows the declared criteria met (`spec-gh-238`, `spec-gh-239` › Verification).
- **Open items.** F1 and F2 are a defect in the contract, not a miss against it: the spec required what was built. They stay open as action items 1–3.
- **Why not rejected.** Nothing is deployed, so no invented answers exist yet. The owner may still judge F1 blocking and override to **rejected**.

## Open questions

1. What does À relancer mean at the door, and what does Personne sur place mean? Is the split between them still right?
2. On À relancer, should the questions be hidden (as on Personne sur place) or shown but optional?
3. Does any admin view or export read `visits.answers` for À relancer visits? The owner answered this for Personne sur place only (`.memlog.md`, "Owner answer Q2"), and this retro did not trace it.

## Owner answers (2026-09-30)

- **À relancer**, owner's definition: the boss is busy or not there, or is not interested right now but keeps the door open for a later discussion. So nobody may be there who can answer the script.
- **Script answers**: no admin view or export reads them, so nothing depends on À relancer answers.
- **Next step**: update this spec with `bmad-spec` on branch `docs/retro-done-stop-leaves-the-round`. The fix build lands on the same branch.
