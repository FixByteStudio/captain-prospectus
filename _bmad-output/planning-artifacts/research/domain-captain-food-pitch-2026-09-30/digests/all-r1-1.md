# Digest — all dimensions, round 1 (lead, inline; straightforward topology)

Accessed 2026-09-30 unless noted. Raw text in `../imports/`.

## Claims

| # | claim | source | publisher | pub_date | confidence | class |
|---|---|---|---|---|---|---|
| 1 | 0 % commission on dishes, 0 € subscription, 0 € sign-up / setup, no commitment, no exclusivity (keep Uber Eats & Deliveroo) | join.captain.food/tarifs.html + / | Captain.Food (Caring Hope Foundation) | 2026 (site ©2026; legal page Jul 2026) | high (primary, self-description) | pricing |
| 2 | Platform funded by a pay-what-you-want customer contribution added at online checkout (0 € allowed); example: 30 € order → customer pays 32,99 € (2,99 € contribution), restaurant keeps 30 € | join.captain.food/financement.html | Captain.Food | 2026 | high (primary) | pricing |
| 3 | Fallback if contributions fall short: at-cost sharing — small customer participation + restaurant share of real costs divided by number of restaurants; never a commission; disappears when model allows | tarifs.html, financement.html; repo ADR-20260808-203443 ("monthly cascade pricing … fixed platform cost ÷ restaurant count") | Captain.Food site + repo | 2026 / ADR 2026-08-08 | high (two artifacts, same publisher) | pricing |
| 4 | Card payment fees are "standard bank fees of any online payment", never a % on dishes nor a surcharge to the customer | index FAQ, financement | Captain.Food | 2026 | medium — who bears them is ambiguous; repo ADR-0017 & entities.yaml say Captain absorbs Stripe fees as merchant of record | pricing |
| 5 | Delivery is a future channel, not active. Intent: courier paid ≥ 7 € per run; restaurant sets a margin floor, participation capped by it (example 3 €), customer pays remainder (example 4 €); click & collect and table ordering = 0 € for restaurant | livraison.html, index FAQ | Captain.Food | 2026 | high (primary, but explicitly "illustrative") | offer/pricing |
| 6 | Offer: own ordering site tonresto.captain.food (custom domain tonresto.fr optional), click & collect, table QR ordering (payment can stay in own till), delivery later; customer data owned by restaurant (with consent); same prices as dine-in; 18 languages | index | Captain.Food | 2026 | high (primary; but pre-launch) | offer |
| 7 | Status: "Rien n'est encore construit" — pre-launch, mockups only; founder manifesto: no restaurants on board yet, no customers | index, demo, manifeste, EN alternative page | Captain.Food | 2026 | high (self-declared) | status |
| 8 | Deployed V0 service suspended (billing) since ~2026-08-04; team develops on local stack; hosting move to OVH decided, not built | repo docs/STATUS.md @ commit in imports/repo/COMMIT | TheCaptainCompany (GitHub) | 2026-09 | high (primary) | status |
| 9 | Geography: Tours (France) only for now, "un territoire, bien fait"; UI locale fr-FR; restaurant prospection fed by SIRENE (French company register) | index; repo stories.yaml; STATUS | Captain.Food + repo | 2026 | high | scope |
| 10 | Onboarding per site: free sign-up via form (restaurant name, name, email, optional phone/WhatsApp) → callback; Captain.Food handles setup: menu sync, page go-live; if no sync tool (e.g. HubRise) they help set one up — "un service standard que tu gardes en main" | index | Captain.Food | 2026 | high (primary) | onboarding |
| 11 | HubRise costs 35 € HT/month per location (no setup fee, cancel anytime) | hubrise.com/fr/tarifs | HubRise | undated, accessed 2026-09-30 | medium (primary, undated) | pricing |
| 12 | Onboarding per repo (planned product): owner registers account → adds location → chooses storefront address (slug; required before activation) → activates; builds/imports catalog; may claim a pre-listed restaurant via Google Business Profile and point Google's "Order online" button at it; staff invited by email; restaurant signs in by email link; payout to a Stripe Connect account | repo stories.yaml, ADR-0017, ADR-20260818-101500 | repo | 2026-07..09 | medium (spec, not live) | onboarding |
| 13 | Repo still models a margin-proportional restaurant "service contribution" deducted from payout (ADR-0016/0017 status Proposed; fee 5 % of food, 40 % restaurant part × margin score) — conflicts with site's "tu ne paies rien" | repo ADR-0016/0017, specs/common/entities.yaml, referential.yaml | repo | 2026-06/07 (last touched 2026-09-06) | high that it exists; disputed as current policy (superseded in spirit by ADR-20260808) | pricing |
| 14 | Repo partner-landing copy still says "flat subscription / Forfait mensuel fixe" and "Tours' leading food platform" — stale vs site | repo specs/screens/captain_frontoffice.translations.yaml | repo | last touched 2026-09-06 | high that it exists; stale | pricing |
| 15 | Structure: site published by association loi 1901 Caring Hope Foundation, Tours, RNA W372020229; aims at ESUS approval and SCIC cooperative (not yet obtained); code open under "Captain.Food Coopyleft" (AGPL-3.0 based, commercial use reserved to SSE orgs) | mentions-legales, index, repo README | Captain.Food + repo | Jul 2026 | high | structure |
| 16 | Open Collective page exists; at access time showed 1 contributor, no visible totals/expenses | opencollective.com/captain-food | Open Collective | accessed 2026-09-30 | medium (extraction partial) | structure |
| 17 | Uber Eats ~25–35 %, Deliveroo ~25–30 % commission (site says indicative, public sources 2024); avg restaurant net margin ~3 % (Fiducial via UMIH/GHR/SNARR Jun 2025); ~8 000 restaurant failures France 2024 (Altares) | index | Captain.Food (citing others) | 2026 | medium (secondary, self-interested) | market figures |
| 18 | Uber Eats France plans Lite 15 % / Plus 25 % / Premium 30 %; Deliveroo 25–35 % with delivery, negotiated individually | fooderise.com/commission-plateformes | Fooderise (vendor blog, no sources) | undated "2026" | low-medium | market figures |
| 19 | Uber Eats has three packages (Lite/Plus/Premium); does not publish percentages publicly — merchant sees them in Uber Eats Manager; pickup marketplace fee 7 %/10 % from 2026-03-11 | help.uber.com (search snippets) | Uber | 2026 | medium (snippet level) | market figures |
| 20 | In Brussels Uber Eats and Deliveroo charged 30 % (2020); #SaveMyResto, 50+ restaurants asked for 15 % | bx1.be | BX1 | 2020-07-03 | low (stale, > 3 yr) | market figures |
| 21 | Site's own FAQ objections: "free — what's the catch / how do you live?", "must I leave Uber Eats/Deliveroo?", "no customers yet, why sign up now?", "how do I get my customers?", "who pays delivery?", "what about table QR / in-till payments?", "I'll just pass commission on to my prices" | index, tarifs | Captain.Food | 2026 | high (primary) | objections |
| 22 | Market has other commission-free direct-ordering tools in France (e.g. PIINK Me, Collectly, CommandeIci blogs position themselves as alternatives) | search results | various vendors | 2026 | low (search-level only) | competition |

## Leads
- Belgium/Brussels presence: none found; site and repo are Tours/France-only (SIRENE, fr-FR). Absence is a finding.
- No independent press coverage of Captain.Food found (search "Captain.Food Tours" returned nothing relevant).

## Looked for, not found
- Any restaurant contract / CGV / terms for restaurants (P2B terms flagged as pending "counsel packet" in ADR-20260808).
- Onboarding lead time (days to go live) — not stated anywhere.
- Legal/document requirements for restaurants (SIRET, IBAN, Kbis) — only implied by SIRENE + Stripe Connect; not stated on site.
