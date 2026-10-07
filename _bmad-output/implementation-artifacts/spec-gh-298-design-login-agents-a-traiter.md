---
title: 'docs/design.md decides the login page, the Agents page and the fourth À traiter row'
type: 'chore'
created: '2026-10-07'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-own-login/SPEC.md'
  - '{project-root}/docs/adr/0029-own-login-instead-of-cloudflare-access.md'
baseline_commit: 262cf6ae9c3535c02cb6806709cd39a9799405c5
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic own-login (GH #296) builds `/login`, an Agents page and a fourth À traiter row, but CLAUDE.md forbids building a screen `docs/design.md` has not decided. ADR-0029 and CAP-4 defer the login layout to design.md, and design.md's À traiter still says "three rows" (GH #298).

**Approach:** Add three decided sections to `docs/design.md` — `/login`, the Agents page, and the fourth À traiter row — each naming its shadcn elements, states and every French string once, so the build stories copy strings into `copy.ts` without re-deciding. Docs only; no code.

## Boundaries & Constraints

**Always:** Follow the spec's facts exactly: code field by default; 8-char code, 20-char passphrase in five groups of four, both normalised; one error for wrong email or passphrase; lockout sentence "Trop de tentatives depuis cette connexion. Réessayez à {heure}, ou changez de réseau." with the button disabled until then; "Inscrit" / "Pas encore inscrit"; deactivation dialog gives the count of prospects left assigned; last active admin cannot be deactivated or demoted; row "Prospects sans agent actif {n}" with "Réassigner" to Prospects filtered to inactive agents. `/login` is field-reachable: its strings go to `copy/field`, it uses native controls and counts toward the 1,000 KiB precache (ADR-0015, ADR-0026). Compose admin screens from elements already in `src/client/ui/` and the #175 primitives (`ScreenHeader`, `ScreenState`, `Surface`, `EmptyTile`). Write in the file's own voice and density.

**Never:** Edit `EXPERIENCE.md` (its owner updates it; this PR raises it). Edit `copy.ts`, code, `api.md` or `data-model.md`. Rewrite the Layout's Access logout sentence or the "no users table" line in Activité par agent — the 401 and roster stories own those. Name route paths or query params beyond what the screen shows (api.md owns them). Add a shadcn element not yet vendored without saying so.

## Decisions

- The Agents page sits under Pilotage beside Tableau de bord, at `/admin/agents`, icon `Users`; no new sidebar group.
- A deactivated user can be reactivated: deactivated users sit in a collapsed "Désactivés" list with "Réactiver". The "Admins manage users through the API" story's update route must also take `active: true` (raised in the PR).
- "Accès administrateur" is a ghost link-button under the code form that swaps in the email + passphrase form; "Retour au code" swaps back. No switch control, no new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Code sign-in | Default `/login` | One code field, submit button | 401 → one inline error string |
| Admin sign-in | "Accès administrateur" chosen | Email + passphrase fields, autocomplete for password managers | Same 401 string for wrong email or passphrase |
| Lockout | 429 + `Retry-After` | Lockout sentence with Brussels time, button disabled until then | Re-enables at the time, no reload |
| Offline on `/login` | No network | Says so; outbox untouched | No 401 inferred |
| Code shown | Admin generates a code | Shown once with expiry time; a new one replaces it | Closing loses it; regenerate |
| Passphrase shown | Admin (re)generates | Shown once in groups; old one stops working | Closing loses it |
| Deactivate | Agent with n prospects | Dialog names n; confirm removes from assign menu | Last active admin: action disabled with reason |
| Fourth row at 0 / loading | Count 0 or query pending/failed | Muted count, disabled button / "—" | Same rule as the other three rows |

</frozen-after-approval>

## Code Map

- `docs/design.md:227-300` -- Layout: nav groups and the avatar menu; the Agents nav entry is decided here, the logout sentence is left alone.
- `docs/design.md:385-399` -- À traiter: "three rows", icons `Clock`/`Link`/`Copy`, 0/loading/failed rule; extend to four.
- `docs/design.md:404-570` -- Prospects and Doublons: the screen-section voice to copy (ASCII sketch, bullets of decisions, empty states); the Statut chip pattern the inactive-agent filter reuses.
- `docs/design.md:1222-2000` -- The field side and Native controls: rules `/login` inherits (48px targets, `text-base`, native controls, precache).
- `src/client/ui/` -- vendored elements available: alert-dialog, dialog, card, table, badge, input, form, select, dropdown-menu, sheet, alert. No switch.
- `src/client/admin/nav.ts` -- `NAV_GROUPS`; Lucide icons in use.
- `src/client/copy/{field,admin,shared}.ts` -- where the named strings will land later; existing "Se déconnecter" in admin.
- `_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md:132` -- the three-row rule to raise, not edit.

## Tasks & Acceptance

**Execution:**
- [ ] `docs/design.md` -- add `## The login page` as its own top-level section right before `## The field side` (it serves both sides but ships in the field shell) -- decides layout, both forms, errors, lockout, offline, focus and autocomplete.
- [ ] `docs/design.md` -- add `### Agents` admin section after `### The admin round view` -- list (role, Inscrit status, sessions), create form, role change, code panel, passphrase panel, session revoke, deactivation dialog, last-admin guard, empty/loading/failed.
- [ ] `docs/design.md` -- amend `**À traiter**` to four rows, adding "Prospects sans agent actif" with icon, meta line, "Réassigner", and the Prospects chip for the inactive-agent filter; update the Layout nav paragraph for the Agents entry.
- [ ] PR description -- quote the EXPERIENCE.md:132 three-row rule and ask its owner to update it; list every new French string.

**Acceptance Criteria:**
- Given the three sections, when the owner reads them, then each states its shadcn elements, states and strings with no TBD.
- Given any French string the sections name, when grepped in design.md, then it is spelled one way only.
- Given `pnpm lint`, when run, then Prettier passes on design.md.

## Implementation Notes

- The docs-keeper subagent's first draft contradicted the spec and CLAUDE.md: the code field stripped input instead of leaving it to the normaliser, it said no shadcn form (ADR-0018 says otherwise), the lockout never re-enabled, the email had no autocomplete, the per-device session list was missing, and the last-admin guard was server-only. The orchestrator rewrote the three sections directly; only the Layout nav edit survived.
- Decisions taken in design.md that the build stories inherit: the passphrase dialog is only for the signed-in admin's own passphrase (a new admin enrols with a code first); the deactivation dialog's count comes from the agents list (api.md owns the field); the current device shows "Cet appareil" with no Révoquer; `/login` shows the outbox's waiting visits as a reassurance line; the fourth row's count comes from the dashboard endpoint, icon `UserX`, chip "Agent : désactivé".
- ADR-0026 is the precache budget ADR, not a native-controls one; the link names it as such.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Counts: high 0, medium 6, low 14, false/rejected 6. No intent_gap or bad_spec; all survivors patched by the orchestrator (the implementer's draft had been replaced, so re-engaging it was moot).

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| Fourth row and deactivation count link api.md fields that do not exist | medium | patch | api.md:24,26 lack them; text now says the users-routes story names them in api.md |
| Inactive-agent filter has no URL rule or select reading | medium | patch | Added: lives in URL like GH #114 filters, name owned by api.md; select reads "Agent désactivé" |
| Missing French strings (form messages, success and failure toasts) | medium | patch | Added "Saisissez une adresse e-mail valide.", "Saisissez un nom.", "Utilisateur ajouté/désactivé/réactivé.", "L'action n'a pas abouti. Réessayez." |
| New passphrase replaces the old one with no confirmation | medium | patch | Added AlertDialog "Remplacer votre phrase de passe ?" |
| "utilisateur" breaks glossary (user listed under Not for Agent) | medium | patch | Added a User / Utilisateur row to docs/glossary.md; role label now "Admin" per glossary |
| Login: 5xx/426 undecided | medium | patch | Added 5xx string; 426 shows the band's update prompt |
| Code expiry from client clock | low | patch | Now the server-returned expiry |
| Retry-After missing/unparsable | low | patch | Fallback sentence, re-enables after 15 min |
| Swap vs lockout ambiguity | low | patch | Lockout Alert survives the swap |
| Offline vs error Alert precedence | low | patch | One slot, offline wins |
| Outbox read pending/failing | low | patch | Line absent |
| Already signed in on /login; return path after 401 | low | patch | Redirect to landing; always landing, no redirect param |
| Lockout forgotten on reload | low | patch | Stated: next attempt gets the 429 again |
| Clipboard failure | low | patch | "Copie impossible. Recopiez-le à la main." |
| Device label missing | low | patch | "Appareil inconnu" |
| Self-demotion outcome | low | patch | Lands on the round |
| Email case/whitespace duplicates | low | patch | Trimmed and lowercased before sending |
| Deactivate count race | low | patch | Refetched when the dialog opens |
| Mobile: device lines and Désactivés | low | patch | One sentence added |
| Wireframe overflows its box | low | patch | Redrawn |
| Layout's "Se déconnecter" still the Access logout | false | reject | Owned by the 401 story (GH epic #296), which the spec's Never list leaves it to |
| Other screens not updated for deactivated users | false | reject | Owned by the "Every roster reader reads users" story |
| Agent opening /admin after sign-in | false | reject | Existing role gate, not changed by this story |
| ADR-0029 says "switch", design says button | false | reject | ADR hands the layout to design.md; owner chose the button at checkpoint 1 |
| EXPERIENCE.md still says three rows / three confirmations | false | reject | Spec forbids editing it; raised in the PR (lines 132, 114, 205) |
| Strings mentioned more than once | false | reject | Same wording each time; one canonical spelling for copy.ts |

## Verification

**Commands:**
- `pnpm exec prettier --check docs/design.md` -- expected: passes.

**Manual checks (if no CLI):**
- Every spec-mandated string (lockout sentence, Inscrit, Pas encore inscrit, Accès administrateur, Prospects sans agent actif, Réassigner) appears verbatim.
