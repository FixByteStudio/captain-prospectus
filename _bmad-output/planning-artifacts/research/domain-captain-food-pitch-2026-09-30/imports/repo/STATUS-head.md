# 🚦 Captain.Food — Development & Deployment Status

> Hand-maintained snapshot (NOT generated, outside `specs/` so it never affects the DSL).

## 🌐 Deployment

| Piece | Status | Notes |
|---|---|---|
| Render web service (Docker, Frankfurt) | ⏸️ SUSPENDED | Billing-suspended since ~2026-08-04 (`suspenders: ["billing"]`); `captain-food.onrender.com` returns 404. **This is a decided state, not an open incident** — see "Production is DELIBERATELY SUSPENDED" below (ADR-20260817-105844). Blueprint IaC (`render.yaml`) still describes what was live before suspension |
| Supabase Postgres (Frankfurt, eu-central-1) | ⏸️ idle | No live traffic while the Render app is suspended; the team develops/walks against a **local** Postgres stack instead (ADR-20260813-004634) |
| Hosting target — OVH Managed Kubernetes + in-cluster CloudNativePG, GitOps-reconciled | 📋 decided, not built | [ADR-20260807-002705](adr/ADR-20260807-002705-hosting-ovh-mks-cnpg-gitops.md): MKS (Paris), CNPG ≥3 nodes + WAL archiving + restore drills, manifests GENERATED from specs, GitOps-only ops. Realization backlog tracked under [#271](https://github.com/TheCaptainCompany/captain-food/issues/271); the cluster does not exist yet — production cutover is a separate decision to re-take, not a task in flight |
| CI workflow `ci` (build+test+validate+drift; ex `codegen-consistency`) | ✅ | Gates deploys (`autoDeployTrigger: checksPass`); `changes` also runs the decision-lookup stub suite (#679) |
| CI `Claude Code Review` | ✅ | Fires on `opened`/`ready_for_review`/`reopened` — **one pass per presentation, never per push** (ADR-20260826-084500). Re-request = draft → ready |
| CI `db-migrate` (sqlx-cli, gated on green build) | ✅ | Applies `migrations/*.sql` out-of-band (ADR-0043) |
| `/health` (schema-version readiness), `/ping`, `/projector` | ✅ | `>=` version gate; in-process projector |
| GraphQL `/{role}/graphql` + `/{role}/voyager` | ✅ | Role-as-path; per-role filtered schema |
| Custom domains `*.captain.food` (Dynadot wildcard → Render) + Host router | ✅ | Wildcard TLS issued; apex+`www` 301→`join` (GitHub Pages); `hosts.rs` dispatches audiences (`live`/`restos`/`riders`/`system`) + `{slug}` tenants; onrender URL disabled. Recorded in **ADR-0036 amendment (2026-07-18) + ADR-0042** |

## 📖 Read side (queries)

| Query | Status | Notes |
|---|---|---|
| `restaurants` / `restaurant` | ✅ | Real data once SIRENE runs |
| `prospectionPipeline` | ✅ | Admin; fed by SIRENE registrations |
| `pricingPolicy` / `uberEstimationPolicy` / `uberSplitPolicy` | ✅ | **Real seeded data** |
| `catalog` / `categories` | ✅ | **Real nested data** — catalog `tree` projector (categories→products→offers/option-lists + derived `stockStatus`). [#749](https://github.com/TheCaptainCompany/captain-food/issues/749) fixed the storefront MENU paint: `catalog` takes `restaurantId` OR `restaurantSlug` (DSL-declared exactly-one-of, generated check; slug resolves through the SlugAlias path like the tenant host; host-vs-selector disagreement rejects typed), the host-injected `slug` param feeds it through the generated rename bridge, and the `catalog_sections` renderer arm shows the items — pinned end-to-end by `storefront_menu_paint.rs` (real composed schema) and the smoke's L3c menu-paint probe. `categories` (marketplace rail) still requires `restaurantId!` — its §25b skip stands |
| `carts` / `cart` / `orders` / `order` | ✅ wired | Populated as carts/orders are placed |
| `me` / `favoriteRestaurants` | ✅ | `me` resolves the verified ADR-0047 `Principal` → Customer read model; `favoriteRestaurants` joins the customer's favourites |
| Projection worker → registry (per-aggregate checkpoints) | ✅ | In-process; **no batch cap** (drains all pending per tick, loops 1.5s); hardened to **log-skip a poison event** so one bad record can't wedge projection. ⚠️ Free-tier **spin-down** pauses it when the app is idle >15 min → kept warm via **uptimerobot `/ping` every 5 min** |

## ✍️ Write side (mutations)

| Piece | Status | Notes |
|---|---|---|
| `MutationRoot` (all api.yaml mutations generated) | ✅ | |
| Restaurant aggregate (13 commands) | ✅ | Spec invariants (event-stream rehydration) + 25 behaviour tests |
| Cart (3) · Order (11) · DeliveryJob (4) | ✅ | Round 2a — real invariants + tests; **Cart line-checks now enforced** (OfferUnavailable/InsufficientStock/InvalidOptionSelection) via the catalog offer read port |
| Catalog (12) · Prospect (3) · RestaurantAccount (3) | ✅ | Round 2b — real invariants + behaviour tests |
| Customer (14) | ✅ | Wired end-to-end: `customer` read model + Pg repo, fail-closed `AuthProviderGateway` stand-in (real Supabase ACL deferred), injected at the composition root |
| `placeOrder` + process managers (4 sagas) | ✅ wired | `placeOrder` live (fail-closed `PaymentGateway` stand-in); in-process PM runtime (`/saga`) — PlaceOrder/Refund/CartBinding/DeliveryDispatch react to payment/delivery facts → `OrderPlaced`/`OrderDelivered`/… **Real Stripe create-intent = 🅑**; ✅ **checkout-snapshot DSL closed** (ADR-20260719-014434): `PaymentIntentCreated` now carries `checkout` (`CheckoutSnapshot`), frozen by `place_order`, so `OrderPlaced` rebuilds from the log — priced `items`/`breakdown` + retiring the fail-closed `CheckoutSnapshotSource` ride on server-side pricing |
|---|---|---|
| SIRENE ACL (INSEE → RegisterRestaurant mapping) | ✅ | Unit + DB verified |
| Interim direct-write `sirene_sync` binary | ✅ | **Retired** (ADR-0045) — replaced by the split below |
| `external_sirene_restaurants` staging table | ✅ | Migration applied by CI |
| Thin CI ingestion crate `sirene_ingest` (fetch → UPSERT raw rows, France-wide by department, active-only) | ✅ | No domain deps; scheduled workflow builds only this crate |
| On-app `sync_sirene_worker` (ACL on deployed version) + deletion reconciliation | ✅ | Per-row checkpoint; detect-by-absence (21d debounce) + explicit `F`/`C`; NON_PARTNER auto-close, partners flagged; `POST /internal/sirene/drain` (token-gated, fail-closed) |
| `INSEE_API_TOKEN` repo secret | ✅ | Added. **⏳ STOPPED at both ends, and the reason given is stale** (corrected 2026-08-30): the scheduled ingestion → staging → worker chain was paused 2026-07-28 *"until #220"*, and [#220 "Slug lifecycle + SIRENE as inbound event"](https://github.com/TheCaptainCompany/captain-food/issues/220) **closed the same day** (PR [#229](https://github.com/TheCaptainCompany/captain-food/pull/229)), as did the other named bottleneck [#218 "[watchdog] sirene-sync France sweep still exceeds the 90-min CI budget"](https://github.com/TheCaptainCompany/captain-food/issues/218) (PR [#232](https://github.com/TheCaptainCompany/captain-food/pull/232)). **Nobody has re-taken the decision to restart it**, so the chain has been off for over a month behind a blocker that no longer exists — found while checking the premise of the 2026-08-30 STAFF-AUTH answer, whose claim-your-listing path needs listings to claim. Restarting is a decision with real costs (INSEE quota, a ~4h weekly sweep, prospect creation on live data), not a flag flip: [#800](https://github.com/TheCaptainCompany/captain-food/issues/800) |
| `INTERNAL_TRIGGER_TOKEN` (Render env + repo secret) to enable the CI→worker ping | ⏳ | Optional; unset, so `POST /internal/sirene/drain` is fail-closed (503). `RUN_SIRENE_WORKER` **defaults OFF and is bound to register row [`SIRENE-RESTART`](decisions/SIRENE-RESTART.yaml)** (PR [#918](https://github.com/TheCaptainCompany/captain-food/pull/918), 2026-09-06: `decisionRow:` + deploy values `"false"` at both ends, so an env flip alone cannot restart it while the row is open; `runKind: worker`) — see the row above: the blocker it names is closed and the restart decision is open ([#800](https://github.com/TheCaptainCompany/captain-food/issues/800)) |

## 🔌 External integrations — partner adapters & M2M (ADR-20260718-145856 / -213352)

**Partner webhook adapters are self-contained crates** under `crates/adapters/*` — each an ACL +
axum shell + standalone binary, mountable into the monolith **or** deployable as its own web service.
Two directions: partner-**push** webhooks (below) vs external-**drive** `/external/graphql` (M2M).

| Piece | Status | Notes |
|---|---|---|
| **Stripe** — `crates/adapters/stripe` (`POST /adapters/stripe/webhooks`, `stripe-webhook` bin) | ✅ | `Stripe-Signature` HMAC over raw body (constant-time, 300s replay, fail-closed); ACL → `PaymentCaptured`/`PaymentFailed`/`PaymentRefunded`; idempotent by Stripe event id. 12 tests |
| Checkout must set `metadata.restaurantId` (+`orderId`) on the PaymentIntent/charge | ✅ | `StripePaymentGateway` sends `metadata[orderId]`/`[restaurantId]`/`[cartId]` on create-intent — the webhook ACL maps `charge.refunded` from them; exercised by the green prod smoke |
| **HubRise** — `crates/adapters/hubrise` (`POST /adapters/hubrise/webhooks`, `hubrise-webhook` bin) | ✅ | **Ingress** ✅ (HMAC-SHA256 hex, fail-closed, envelope parse). **Outbound OAuth2 client** ✅ (`api.rs`: `X-Access-Token`, non-expiring token from `HUBRISE_ACCESS_TOKEN`, `exchange_code` connect helper, catalog/inventory pull). **Domain wiring** ✅ (`enrich.rs`): verified catalog/inventory callback → API pull → enrichment ACL → `ImportCatalog` / per-SKU `update_offer_stock` handlers. **Deterministic UUIDv5-of-HubRise-id** ids reconciled with the **Catalog aggregate** (offer seeded from the SKU `ref` = inventory's `sku_ref`, so a stock update hits the imported `OfferId`); `"9.80 EUR"`→`Money`, tax-rate strings→`TaxRate`, `data` envelope translated at the boundary; catalog = rejectable command (`CatalogNotFound`→skip), inventory = reported fact (`OfferNotFound`→skip, never rejected). 14 tests. Enricher wired at the server composition root + the standalone bin (needs only `DATABASE_URL`). ✅ **Connect flow landed (#20, ADR-20260721-100601)**: OAuth connect provisions account/locations/catalogs with the derived ids + stores the account-scoped token in `hubrise_connections` (env token retired) |
| **`/external/graphql`** — M2M standard | ✅ | External entities query/mutate via the `EXTERNAL` role path; API-key auth (`X-External-Api-Key`, ADR-0047); allowlist is per-op `roles: [EXTERNAL]`. **Subscribe** = future (needs `SubscriptionRoot` + WS + `api.yaml`); per-partner keys = future |
