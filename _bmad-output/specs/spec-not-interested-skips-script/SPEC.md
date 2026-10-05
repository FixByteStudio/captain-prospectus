---
id: SPEC-not-interested-skips-script
companions:
  - refusal-reasons.md
  - ../spec-done-stop-leaves-the-round/when-step.md
sources:
  - ../../forge/not-interested-skips-script/forged-idea.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Pas intéressé records a reason, not the script

## Why

This fixes a problem field agents hit, and it lets the team learn something. A restaurateur who says no won't answer a whole questionnaire, yet today a Pas intéressé visit must answer every required script question. Only `no_contact` skips them (`src/client/field/visit-draft.ts:188`). As a result, agents either make up answers or fight the form on the pavement. When refusals skip the script, one tapped reason becomes the only record of why Brussels says no to Captain Food. That record is what the team needs to adjust the pitch before launch.

## Capabilities

- **CAP-1**
  - **intent:** On Pas intéressé, the agent picks one refusal reason instead of answering the script.
  - **success:** With a script cached, Pas intéressé shows step 2 with the reason radios in place of the questions, and the notes stay. The visit saves with no script answers (`answers: {}`), even if answers typed under another result are still in the draft. It can't be saved without a reason, or with "Autre" and empty notes. Both errors come from `copy/field`. Other results behave exactly as they do today.
- **CAP-2**
  - **intent:** The reason comes from one fixed list that separates real refusals from "come back later".
  - **success:** The radios show exactly the 7 labels of `refusal-reasons.md` in its order, as native inputs. Each stores its English value. Nothing else can be chosen.
- **CAP-3**
  - **intent:** The server keeps the reason with the visit, and every phone still syncs.
  - **success:** A `not_interested` visit with a reason is stored with it in a new nullable column. A visit without one (an old build) is accepted and stored with null. A reason sent with any other result is stored as null, and the visit is never refused over it. The prospect still becomes `rejected`.
- **CAP-4**
  - **intent:** Admins see why each refusal happened.
  - **success:** The Visites ledger shows the French label next to Pas intéressé. Older visits with no reason show nothing, not "Refus sans raison".
- **CAP-5**
  - **intent:** Admins can isolate and count refusals by reason.
  - **success:** Visites has a "Raison du refus" filter (the 7 reasons) that works together with the period, and the live feed respects it. `GET /api/admin/visits` and `GET /api/admin/visits/export.csv` take the same `reason` filter, so the export's rows match the screen. The visits CSV gains a `refusal_reason` column (English value, empty when there is none).
- **CAP-6**
  - **intent:** Agents and admins share one definition of the reasons and of what isn't one.
  - **success:** `docs/domains/prospecting.md` or `field-operations.md` holds the list and the rule from `refusal-reasons.md`. `docs/data-model.md` describes the column, and `docs/api.md` the new optional sync field. `docs/glossary.md` adds **Refusal reason / Raison du refus**.

- **CAP-7**
  - **intent:** A prospect an agent reported "Hors cible / fermé" becomes a to-fix item for an admin.
  - **success:** Prospects has a filter "Hors cible signalé", with a count, listing every prospect whose latest visit carries `out_of_target`. A prospect leaves the list once an admin edits its fields or status directly after that visit, which stamps a new nullable `out_of_target_reviewed_at`. Assigning, merging or a CSV import does not count. A newer visit with another result also takes it off.

## Constraints

- The sync change is additive only: `refusalReason` is optional in `visitSchema`, and the migration adds a nullable column (expand only). There's no `clientVersion` bump (`docs/api.md` conventions, `sync-contract-change` skill).
- The reason never costs a visit (INVARIANT 5). The server stores null rather than refusing a visit whose reason is missing, or sent with another outcome.
- Status is still computed by the server through `OUTCOME_TO_STATUS`: `not_interested` → `rejected`, whatever the reason (INVARIANT 3).
- Values are English in the database and labels are French in `copy/field` (INVARIANT 15). The schema is `zod/mini` (INVARIANT 6).
- The Hors cible flag never relies on `prospects.updated_at`, because assign, merge and CSV import also change it.
- On the field route, the radios are native (ADR-0015, ADR-0026), and the PR quotes the precache total against the 1,000 KiB ceiling.
- The Visites filter works together with the feed's `since` polling and the `from`/`to` range. It never replaces them.
- The server never checked required answers, so requiring or dropping them is a phone-side change only (`visit-draft.ts`).

## Non-goals

- Changing the refusal status model or reopening refused prospects. `rejected` stays as it is.
- A dashboard tile or chart of reasons. For now, the Visites filter and the CSV are enough.
- Letting an admin edit the reason list. It's a fixed list, because an editable one is a second script.
- Refusal reasons on any result other than Pas intéressé.
- Changing the script itself, or how it applies to other results.
- Filling in reasons for visits already stored.
- An admin view of one prospect's visit history. None exists today, and this spec doesn't add one.

## Success signal

- An agent records a refusal in one tap after the result, with no script question in the way. After a canvassing day, an admin can say how many refusals were "Trop d'applis / de tablettes", and so on, straight from the app.

## Assumptions

- The reason is required on the phone for Pas intéressé. The owner leans towards one required tap.
- Pas intéressé always gets step 2, whether or not there's a script, the same way the when step works for `no_contact`: there is always a reason to ask.
- No ADR is needed. It's one additive field and a nullable column. The permanent part is the stored values, and their home is the domain doc (ADR-0024).
