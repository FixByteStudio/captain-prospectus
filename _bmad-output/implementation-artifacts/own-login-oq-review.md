# Review: open questions in the own-login spec

Current block: wrap-up

- [x] **1. Intent** — done. Text: The spec (link [SPEC.md](../specs/spec-own-login/SPEC.md)) turns [ADR-0029](../../docs/adr/0029-own-login-instead-of-cloudflare-access.md) into 14 capabilities. Seven points the ADR left open must be decided before the work is sliced into stories. Source: SPEC.md › Open Questions.
- [ ] **2. Broad strokes** — skipped by reviewer (unchecked). Entry points: SPEC.md › Open Questions; [auth-data.md](../specs/spec-own-login/auth-data.md) tables and login request; [cutover.md](../specs/spec-own-login/cutover.md) phases.
- [x] **3. Q1 — Passphrase format and entropy** — done
- [x] **4. Q2 — Does the passphrase form ask for the email?** — done
- [x] **5. Q3 — Where the device label comes from** — done, changed during review: chose a different option than recommended
- [x] **6. Q4 — Does a new code void earlier unused codes?** — done
- [x] **7. Q5 — Where a deactivated agent's prospects are flagged** — done
- [x] **8. Q6 — What /login shows during a lockout** — done
- [x] **9. Q7 — What ends phase 2** — done
- [ ] **10. Periphery** — folded into wrap-up (unchecked). `.memlog.md` of the spec, ADR-0029 if amended.
