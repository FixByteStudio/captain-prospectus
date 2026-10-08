---
title: 'domain research: Captain Food pitch'
type: 'domain'
topic: 'Captain Food pitch'
decision: 'What a canvassing agent must know to pitch Captain Food to a restaurant or food truck'
source: 'native run'
status: complete
preset: 'standard'
validation: 'normal'
created: '2026-09-30'
updated: '2026-09-30'
claims: { verified: 5, unverified: 4, disputed: 1, overturned: 0 }
---

# Domain research: Captain Food pitch

**Decision this research serves:** what a canvassing agent must know to pitch Captain Food to a restaurant or food truck: offer, fees, onboarding steps, requirements, and common objections.

## Executive summary

**The pitch works in one line, but only if the agent is honest about three facts.**

The line: *free for the restaurant, 0 % commission on dishes, no subscription, no exclusivity, and the restaurant keeps its customers* [1][2]. This is stated consistently across the French site and the repo's latest funding decision [11].

The three facts:

1. **Nothing is live yet.** The site says "rien n'est encore construit" and shows mockups only [1][7][8]. The founder writes that there are no restaurants and no customers on board [5]. The one deployed test service has been suspended since about 2026-08-04 [10]. **Today the agent is signing restaurants up as founding members, not selling a product.**
2. **The platform covers Tours (France) only.** The site covers Tours only [1]. The product is built for French restaurants: fr-FR locale, restaurant data taken from the French company register (SIRENE) [10][14]. None of the sources mentions any other city. *For this project:* `docs/vision.md` puts the canvass in Brussels. That is project context, not evidence, but it means someone must confirm the territory before any pitch goes out.
3. **"Free" is a bet, and the terms say so.** The platform is funded by an optional pay-what-you-want contribution added by the customer [3]. If contributions don't cover costs, restaurants would share the running costs at cost, split across all restaurants [2][3][11]. The repo also still contains an older fee model in which restaurants give up a margin-based share of each order [12][13]. **Fees are the claim the agent must phrase most carefully.**

**Biggest caveat:** there is no independent source. No press coverage, customer reviews, or published restaurant terms were found. Everything about Captain Food comes from Captain Food itself. The comparison with Uber Eats and Deliveroo is backed by third parties only in broad ranges [18][19].

## 1. The offer: what the restaurant gets

- **Its own ordering site under its own name**, at `tonresto.captain.food`, included. It can also use its own domain (`tonresto.fr`) as an option [1][5].
- **Three ways to take orders from that site**, none with commission on dishes [1]:
  - **À emporter (click and collect):** order ahead, pick up at the counter. No new equipment needed.
  - **À table (QR code):** the customer orders from the table. Payment can stay in the restaurant's usual till, and Captain Food doesn't touch it.
  - **En livraison (delivery):** a *future* channel, not active yet [4].
- **The customer list belongs to the restaurant** from its first direct order, with the customers' consent, so it can run its own loyalty programme [1].
- **Same prices as dine-in.** There is no second, inflated online menu [1].
- **18 languages** on the landing page, with the same planned for the product [1].
- **Planned features in the repo:** a back office with an order queue (accept, prepare, ready), menu management, marking a dish as sold out, staff invitations, refund and complaint handling, and a claimable Google Business Profile "Commander en ligne" button that points to the restaurant's page [14]. The restaurant mockup shows the same order queue and sold-out switch [7]. Confidence: medium. These are specifications, not a live product.
- **Stated target customers:** independent restaurants, food trucks, and neighbourhood food businesses. Large chains chasing volume at the lowest cost are explicitly told it is probably not for them [1].

## 2. Fees and commission

| Item | What Captain Food says | Confidence |
|---|---|---|
| Commission on dishes | **0 %, always** [1][2] | high |
| Subscription / plan | **0 €**, no paid tiers [2] | high |
| Sign-up and setup | **0 €** [2] | high |
| Commitment / exclusivity | **None.** The restaurant keeps Uber Eats and Deliveroo [1][2] | high |
| Who funds the platform | **The customer**, through an optional pay-what-you-want contribution at online checkout, possibly 0 €. Example: a 30 € order costs the customer 32.99 € (2.99 € contribution) and the restaurant receives 30 € [3] | high (it is a stated bet) |
| If contributions fall short | Costs shared **at cost, never as commission**. The customer adds a small participation, and restaurants share the real costs divided by the number of restaurants, so the share shrinks as more join. It goes back to free when the model allows [2][3]. The repo describes this as "monthly cascade pricing" [11] | high that this is the stated plan; **the amount is unknown** |
| Card payment fees | "Standard bank fees", never a percentage on dishes and never a surcharge to the customer [1][3]. The repo says Captain Food, as merchant of record, absorbs the card processor's (Stripe) fees [12][13] | medium. The site wording leaves it unclear who pays; confirm with Captain Food |
| Payment at the till | Outside Captain Food entirely and free [1] | high |
| Delivery (future) | Intended courier pay: **at least 7 € per run**. The restaurant sets its own minimum margin, and its share is capped by it (example: 3 €). The customer pays the rest (example: 4 €). Only on delivered orders [4] | medium. Intent only, labelled "illustrative" |
| Sync tool | If the restaurant has no menu-sync tool, Captain Food helps set one up, e.g. HubRise [1], which costs **35 € HT/month per location** [16] | medium. The site doesn't say who pays for it |

**Disputed: does the restaurant ever pay per order?** The site says "tu ne paies rien". The repo, at the commit in `imports/repo/COMMIT`, still models a `restaurantContribution` deducted from the restaurant's payout on each order. In that model the service fee is 5 % of the food total, 40 % of it charged to the restaurant and scaled by its margin, so a 55 %-margin food truck pays 0 and a 70 %-margin bistro pays the most [12][13]. The ADRs behind it are still *Proposed* (dated June and July 2026). The later accepted funding decision of 2026-08-08 [11] matches the site. Old partner-page copy in the repo also still reads "abonnement forfaitaire / forfait mensuel fixe" [15]. **The agent should quote the site, and never promise that restaurants will pay nothing at any point in the future.**

## 3. Onboarding steps and requirements

**What the site says today** [1]:

1. The restaurant fills in the "Je rejoins les restaurateurs libres" form: restaurant or food-truck name, contact name, email, and optionally phone or WhatsApp.
2. Captain Food calls back to present the project, with no commitment. There is also a WhatsApp community and the address `miam@captain.food`.
3. Captain Food sets things up: menu sync and putting the page online, "à ton rythme". If the restaurant has no sync tool (such as HubRise), Captain Food helps install one.
4. The restaurant keeps its current platforms.

**What the repo plans, once live** [14][12] (medium confidence):

1. The owner creates an account, adds a location, and chooses the page address. A location can't go live without an address.
2. The owner builds or imports the menu.
3. The owner can claim a restaurant that is already listed, proving ownership through Google Business Profile, and point Google's order button at the new page.
4. The owner invites staff by email [14]. Restaurant staff sign in with an email link [21].
5. Payouts go to the restaurant's **Stripe Connect** account.

**Requirements the agent can infer, though none is stated to restaurants:**
- A French registered business, since prospection runs on SIRENE [10].
- A bank account that can be linked to Stripe Connect [12].
- Probably a menu-sync tool (HubRise) [1][16].

**Not found:** go-live lead time, restaurant terms and conditions (the ADR routes them to a pending legal review [11]), and a list of required documents.

## 4. Vocabulary: words to use and words to avoid

| Say (their words) | Meaning |
|---|---|
| *0 % de commission sur tes plats* | Always add "sur tes plats". The claim is scoped to the dishes |
| *contribution libre / prix libre* | The customer's optional contribution, not a fee |
| *le pari* | The funding bet, presented openly as a bet |
| *restaurateurs libres / embarquer / à bord* | The community and its nautical branding |
| *ton canal direct, sous ton nom* | Positioning next to marketplaces, not against them |
| *bien commun numérique* | Open code under the "Captain.Food Coopyleft" licence (based on AGPL-3.0) [2][9] |
| *ESUS / SCIC* | Target legal statuses, **not obtained yet** [1][5] |
| *Caring Hope Foundation* | The non-profit association (loi 1901) that publishes the site, based in Tours, RNA W372020229 [6] |

The site speaks to restaurateurs with **"tu"** throughout [1]. Agents should match whatever register the restaurateur uses.

## 5. Objections and answers

The FAQ covers objections 1–6, so those answers can be quoted [1][2][3]. Objections 7–10 are **the agent's inference** from the gaps this research found, with answers drawn from the evidence.

| # | Objection | Answer backed by the sources |
|---|---|---|
| 1 | *"C'est gratuit, c'est quoi le piège ?"* | The customer funds it through an optional contribution; the restaurant pays no commission, no subscription and no setup fee. The fallback is at-cost cost-sharing, never commission [2][3] |
| 2 | *"Je dois quitter Uber Eats / Deliveroo ?"* | No. There is no exclusivity; Captain Food is an extra direct channel [1] |
| 3 | *"Il n'y a pas encore de clients, pourquoi maintenant ?"* | It costs nothing and asks for no exclusivity. The restaurant gets its customer list from its first direct order, and early members shape the tool [1] |
| 4 | *"Je répercute la commission sur mes prix, ça me va."* | Higher online prices mean fewer orders, and the lost orders are invisible. Passing half the commission on loses both volume and margin [1] |
| 5 | *"Qui paie la livraison ?"* | Delivery isn't active yet. The plan: at least 7 € per run to the courier, with the restaurant's share capped by a minimum margin it sets itself [4] |
| 6 | *"Et le paiement à table / en caisse ?"* | Payment at the till stays outside Captain Food and costs nothing. QR ordering paid online may carry the optional customer contribution [1] |
| 7 | *"Vous avez combien de restos ? Je peux voir l'appli ?"* (inferred) | Be honest: there are **mockups only** [7], and the founder states there are no restaurants yet [5]. Offer the demo and the feedback form, and pitch it as helping to build it |
| 8 | *"Et si ça ne marche pas, vous me facturerez ?"* (inferred) | Only at-cost cost-sharing, divided among all restaurants, and never a percentage [3]. The amount isn't published; **don't give a figure** |
| 9 | *"HubRise, c'est payant."* (inferred) | True: 35 € HT/month per location [16]. Captain Food says it helps with setup, and the site calls it a standard tool the restaurant keeps control of [1]. **Who pays is unconfirmed**, so escalate the question |
| 10 | *"Qui êtes-vous ? C'est sérieux ?"* (inferred) | A non-profit association in Tours [6], open code on GitHub [9], and accounts published on Open Collective [3]. That page showed almost no activity when checked [17]. ESUS and SCIC are goals, not statuses held yet [5] |

On objection 10, don't show the Open Collective page as proof yet. When checked it listed a single contributor and no visible totals or expenses [17].

**Comparison figures the agent may quote, with care.** Captain Food uses Uber Eats **~25–35 %** and Deliveroo **~25–30 %**, which it calls indicative, from 2024 public sources [1]. It also uses restaurant net margins of **~3 %** (Fiducial, via UMIH/GHR/SNARR, June 2025) [1]. A vendor blog puts Uber Eats' French plans at Lite 15 %, Plus 25 % and Premium 30 % [18]. Uber publishes the plan names but not the percentages; merchants see their rate in Uber Eats Manager [19]. Rates are negotiated one by one [18]. **The safe line is "souvent entre 25 et 35 %, vérifiez votre relevé"**: often between 25 and 35 %, check your statement.

## Cross-dimension insights

- **Offer × status:** every benefit in section 1 is a promise. The honest pitch is a **sign-up as a founding member at no cost**: nothing is lost by saying yes, and the restaurant gets a say in the tool. The site itself pitches it that way [1][5].
- **Fees × onboarding:** "0 €" covers Captain Food's own charges. Once live, a restaurant may still meet costs Captain Food doesn't charge itself: a sync tool at 35 € HT/month [16], card fees whose payer isn't stated clearly [1][12], and a future delivery share [4]. Listing these upfront makes the pitch more credible.
- **Scope × project:** Captain Food relies on French infrastructure (SIRENE, fr-FR, a Tours association) [6][10][14]. Nothing links it to Belgium.

## Recommendations

1. **Confirm the territory with the owner before any agent pitches.** Captain Food covers Tours only [1][9][10]. If the canvass stays in Brussels, ask Captain Food whether it accepts sign-ups from Belgian businesses. Confidence: high that there is a mismatch; the answer is unknown.
2. **Build the agent's flyer and question script from sections 2 and 5**, quoting only high-confidence lines. Consumer: the question script the admin edits (`docs/vision.md`, core job 3) and `copy.ts` if any of it is shipped.
3. **Ask Captain Food three questions before scaling the pitch:**
   - Does the margin-based restaurant contribution in the repo still apply [12][13]?
   - Who pays for HubRise and for card fees [1][16]?
   - What is the go-live lead time?

   Until they answer, agents should say "on vous confirmera".
4. **Record the pitch outcome as a founding-member sign-up**, not a sale.

## Open questions

| Question | How to answer it |
|---|---|
| Does Captain Food accept restaurants outside Tours or outside France? | Email `miam@captain.food` |
| Is the margin-based restaurant contribution dead, or deferred until delivery launches? | Ask the founder; check for an ADR that supersedes ADR-0016/0017 |
| Who pays for HubRise and for Stripe fees? | Ask Captain Food |
| How long does it take to go live, and which documents are needed (SIRET, IBAN)? | Ask Captain Food; restaurant terms are pending legal review [11] |
| Is there independent evidence (press, early restaurants)? | Run Deepen once launched; nothing was found as of 2026-09-30 |

## Source appendix

| # | Supports | Publisher | Pub date | Accessed | Confidence |
|---|---|---|---|---|---|
| 1 | Offer, positioning, FAQ, onboarding, comparison figures | [Captain.Food — home (FR)](https://join.captain.food/) | 2026 (©2026) | 2026-09-30 | high (self) |
| 2 | Pricing: 0 €, no subscription, fallback | [Captain.Food — Tarifs](https://join.captain.food/tarifs.html) | 2026 | 2026-09-30 | high (self) |
| 3 | Funding model, 30 € example, Open Collective | [Captain.Food — Financement](https://join.captain.food/financement.html) | 2026 | 2026-09-30 | high (self) |
| 4 | Delivery intent, 7 € per run, margin floor | [Captain.Food — Livraison](https://join.captain.food/livraison.html) | 2026 | 2026-09-30 | medium (intent) |
| 5 | No restaurants or customers yet; ESUS/SCIC as goals | [Captain.Food — Manifeste](https://join.captain.food/manifeste.html) | 2026 | 2026-09-30 | high (self) |
| 6 | Publisher: Caring Hope Foundation, RNA W372020229 | [Captain.Food — Mentions légales](https://join.captain.food/mentions-legales.html) | 2026-07 | 2026-09-30 | high |
| 7 | Restaurant back-office mockup, "rien n'est encore construit" | [Captain.Food — démo resto](https://join.captain.food/demo/resto.html) | 2026 | 2026-09-30 | high |
| 8 | EN alternative page repeats pre-launch and 0 % | [Captain.Food — Uber Eats alternative Tours](https://join.captain.food/en/uber-eats-alternative-tours.html) | undated | 2026-09-30 | high (self) |
| 9 | V0 in Tours; Coopyleft licence | [GitHub — captain-food README](https://github.com/TheCaptainCompany/captain-food) | 2026-09 | 2026-09-30 | high |
| 10 | Deployment suspended ~2026-08-04; SIRENE paused | [GitHub — docs/STATUS.md](https://github.com/TheCaptainCompany/captain-food/blob/main/docs/STATUS.md) | 2026-09 | 2026-09-30 | high |
| 11 | Voluntary contribution plus cascade fallback (Accepted) | [GitHub — ADR-20260808-203443](https://github.com/TheCaptainCompany/captain-food/tree/main/docs/adr) | 2026-08-08 | 2026-09-30 | high |
| 12 | Margin-based restaurant contribution; Stripe Connect split (Proposed) | [GitHub — ADR-0016 / ADR-0017](https://github.com/TheCaptainCompany/captain-food/tree/main/docs/adr) | 2026-06/07 | 2026-09-30 | high (exists) / disputed (current) |
| 13 | `PaymentBreakdown`: restaurantPayout = articles − restaurantContribution | [GitHub — specs/common/entities.yaml](https://github.com/TheCaptainCompany/captain-food/blob/main/specs/common/entities.yaml) | 2026-09 | 2026-09-30 | high |
| 14 | Planned owner and manager onboarding and back office | [GitHub — specs/stories.yaml](https://github.com/TheCaptainCompany/captain-food/blob/main/specs/stories.yaml) | 2026-09 | 2026-09-30 | medium (spec) |
| 15 | Stale "flat subscription" partner copy | [GitHub — captain_frontoffice.translations.yaml](https://github.com/TheCaptainCompany/captain-food/blob/main/specs/screens/captain_frontoffice.translations.yaml) | 2026-09 | 2026-09-30 | high (exists) |
| 16 | HubRise at 35 € HT/month per location | [HubRise — Tarifs](https://www.hubrise.com/fr/tarifs) | undated | 2026-09-30 | medium |
| 17 | Open Collective page shows almost no activity | [Open Collective — captain-food](https://opencollective.com/captain-food) | n/a | 2026-09-30 | medium |
| 18 | Uber Eats Lite/Plus/Premium 15/25/30 %; Deliveroo 25–35 % | [Fooderise — Commissions 2026](https://www.fooderise.com/commission-plateformes) | 2026 (undated) | 2026-09-30 | low–medium (vendor, no sources cited) |
| 19 | Uber packages named, percentages not public; pickup fee change 2026-03-11 | [Uber Help — marketplace fee changes](https://help.uber.com/merchants-and-restaurants/article/uber-eats-marketplace-fee-changes--?nodeId=2cec9c6f-a7b8-47b5-8cc8-07c8a2c24569) | 2026 | 2026-09-30 | medium (snippet) |
| 20 | Brussels: Uber Eats and Deliveroo at 30 %, #SaveMyResto (context only) | [BX1](https://bx1.be/categories/news/des-restaurants-demandent-quuber-eats-et-deliveroo-diminuent-leur-taux-de-commission-a-15/) | 2020-07-03 | 2026-09-30 | low (stale) |
| 21 | Restaurant staff sign in by email link (Accepted, not built) | [GitHub — ADR-20260818-101500](https://github.com/TheCaptainCompany/captain-food/tree/main/docs/adr) | 2026-08-18 | 2026-09-30 | medium (decided, not built) |

Repo sources were read at the commit recorded in `imports/repo/COMMIT`. Source [20] is kept for Brussels context only; it is over 3 years old and no finding rests on it [20].

## Staleness map

Computed with `recon_kit.py staleness`:

| Claim | Class | Re-check by |
|---|---|---|
| Pre-launch; test service suspended | status | **2026-10-01** |
| Onboarding steps | onboarding | 2026-10-01 |
| 0 % commission, 0 € subscription and setup | pricing | 2026-12-01 |
| Does the restaurant ever pay per order (disputed) | pricing | 2026-12-01 |
| Tours-only scope | scope | 2026-12-01 |
| HubRise at 35 € HT/month | pricing | 2026-12-01 |
| Uber Eats / Deliveroo 25–35 % | market | 2028-01-01 |
| ESUS/SCIC not obtained | regulatory | **stale now**. Regulatory status is re-checked on every use |

The earliest re-check is **2026-10-01**. Launch status changes fastest: re-run a Refresh before every canvassing wave.
