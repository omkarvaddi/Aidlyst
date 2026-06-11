# Aidlyst Backend

This backend is the control plane for Aidlyst medical/home-health commerce decisions. It does not publish or sell products by itself; it authorizes whether a SKU may be published, checked out, routed to affiliate/lead-gen/retailer/manufacturer paths, or blocked.

## What It Enforces

- Automatic risk classification for medical and home-health product candidates.
- Supplier/manufacturer checks for freshness, price, availability, return terms, and fulfillment readiness.
- Seller-of-record, compliance, supplier, labeling, and review gates before publishing.
- Checkout blocking unless the SKU is routed to a checkout-safe mode and fulfillment is ready.
- Structured routing to `affiliate`, `lead_gen`, `retailer_checkout`, `manufacturer_direct`, `direct_fulfillment`, or `do_not_list`.
- Audit records for risk, gate decisions, claims/source evidence, routing, and authorization outcomes.
- File-backed catalog import from the Obsidian business datasets.
- Idempotent decision records for repeat-safe API calls.
- Shopify draft-product planning only after publishing authorization succeeds.

## Run

```powershell
cd backend
npm test
npm start
```

Default local URL:

```text
http://localhost:8791
```

Local runs bind to `127.0.0.1` by default. Set `AIDLYST_BIND_HOST` only when you intentionally want a wider network bind.

Production-like runs (`NODE_ENV=production`, `preview`, or `staging`) require `AIDLYST_BACKEND_API_KEY` to be set to a 24+ character server-only value before the server starts. Keep that key in Vercel, Cloudflare, or a local untracked `.env` file. Never expose it as `NEXT_PUBLIC_*`.

## Endpoints

- `GET /health`
- `GET /v1/control-plane/status`
- `POST /v1/control-plane/import-vault`
- `GET /v1/catalog/products`
- `GET /v1/catalog/suppliers`
- `GET /v1/catalog/offers`
- `GET /v1/catalog/push-queue`
- `POST /v1/evaluate-sku`
- `POST /v1/evaluate-stored`
- `POST /v1/batch/evaluate-sku`
- `POST /v1/authorize-publishing`
- `POST /v1/authorize-checkout`
- `POST /v1/shopify/draft-plan`
- `GET /v1/audits/:auditId`
- `GET /v1/decisions/:decisionId`
- `POST /v1/auth/login`
- `GET /v1/auth/session`
- `POST /v1/auth/logout`
- `GET /v1/dashboard`
- `POST /v1/dashboard/actions`

Audit JSON files are written to `backend/data/audits/` by default. Set `AIDLYST_AUDIT_DIR` to override that path.

Catalog, decision, and idempotency files are written to `backend/data/control-plane/` by default. Set `AIDLYST_CONTROL_DIR` to override that path.

## Production Database Target

`db/schema.sql` defines the Postgres/Supabase target schema for the same control-plane concepts:

- product candidates
- suppliers and supplier offers
- Shopify push queue rows
- direct-sales readiness
- policy versions
- commerce decisions
- audit events
- evidence items
- idempotency keys
- Shopify draft plans
- national healthcare entities
- entity locations and identifiers
- source records and ingestion runs
- facility and manufacturer profiles
- supplier verification profiles
- supplier lead, contact, deal, relationship, score, contract, document, and export-log records
- customer consent events, short-lived preference cache, opt-in saved preferences, recommendation events, redaction events, deletion requests, and profile compilations
- regulatory product records
- inventory feeds and snapshots
- localized B2B matches
- clinical-fit reviews
- data-quality findings

The current local server remains file-backed so it can run without credentials. The schema is the migration target for a deployed Supabase/Postgres backend.

## Supplier Intelligence and Customer Privacy

Aidlyst's durable data moat is supplier-side intelligence: company metadata, people maps, source evidence, product/regulatory facts, fulfillment terms, relationship history, contract terms, compliance documents, scoring snapshots, and export logs.

Customer product-fit data is privacy-limited by default. Guest sessions should use short-lived preference cache rows with expiry timestamps. Durable personalization should be created only after explicit opt-in consent and should store derived product preferences instead of raw medical narratives. The schema enforces this direction with `customer_preference_cache_no_raw_health_text` and `privacy_redaction_events_no_raw_content` checks.

Public APIs and storefront payloads should expose only curated product records and safe aggregates. They must not expose supplier scoring weights, private notes, contract terms, raw source files, customer health-intent data, or unredacted preference inputs.

The national database rollout plan is in `NATIONAL_HEALTHCARE_DATABASE_PLAN.md`. It defines how to build coverage for hospitals, clinics, health centers, labs, medical-device manufacturers, drug/pharmaceutical manufacturers, verified suppliers, inventory feeds, localized B2B matching, and doctor-fit reviews without making unsupported FDA, NPI, or real-time inventory claims.

## Import Vault Data

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:8791/v1/control-plane/import-vault `
  -ContentType application/json `
  -Body '{}'
```

The default vault path is `../obsidian-vault` from this backend. Override with:

```json
{ "vaultPath": "C:\\Users\\omkar\\Downloads\\Aidlyst\\obsidian-vault" }
```

## Evaluate Stored Rows

```json
{
  "pushQueueId": "PUSH-TEST-001",
  "action": "publish"
}
```

The backend resolves the push row to product, supplier, and offer records, builds the evaluator payload, runs all gates, writes an audit record, and stores a decision record.

## Checkout Authorization

`POST /v1/authorize-checkout` is the checkout gate. It returns `200` only when the SKU resolves to `retailer_checkout`, `manufacturer_direct`, or `direct_fulfillment` and all required seller-of-record, compliance, supplier, labeling, review, and fulfillment gates pass.

Expected local QA outcomes:

- Affiliate, lead-gen, `do_not_list`, stale, missing-review, missing-labeling, or missing-fulfillment payloads return `409`.
- A fresh retailer/manufacturer/direct-fulfillment payload with approved gates returns `200` and an `auditId`.

The Shopify theme must keep checkout disabled until a server-side Shopify app, app proxy, or checkout/server function calls this endpoint and records the audit decision. Do not rely on browser-only approval for production checkout.

## Idempotency

Send either `Idempotency-Key` or `X-Idempotency-Key` on mutation-style requests. A repeated key returns the original decision instead of creating a second audit.

## Optional API Key

Set `AIDLYST_BACKEND_API_KEY` to require either:

- `Authorization: Bearer <key>`
- `X-Aidlyst-Api-Key: <key>`

Leave it unset for local development.

For internet-exposed environments, do not leave it unset. The server refuses to start in production-like environments without it.

## Development Role Login

The local backend can include development-only accounts so the website preview can be tested without external identity infrastructure. These auth routes are enabled only for non-production-like environments by default. They are disabled when `NODE_ENV` is `production`, `preview`, or `staging`.

No default password is committed. Set a local untracked password before using development login routes:

```powershell
$env:AIDLYST_DEMO_PASSWORD='use-a-local-only-password'
```

| Role | Email |
| --- | --- |
| Customer | `customer@aidlyst.local` |
| Employee | `employee@aidlyst.local` |
| CEO | `ceo@aidlyst.local` |

Override the shared demo password with `AIDLYST_CUSTOMER_PASSWORD`, `AIDLYST_EMPLOYEE_PASSWORD`, or `AIDLYST_CEO_PASSWORD` when role-specific local passwords are needed.

Set `AIDLYST_DISABLE_DEV_AUTH=1` to disable development login routes locally.

Dashboard permissions:

- Customer: account and product-research portal only.
- Employee: metrics and audit context only; no executable actions.
- CEO: metrics, audit context, exports, and executive actions.

## Shopify Draft Planning

`POST /v1/shopify/draft-plan` accepts either a raw evaluator payload:

```json
{ "payload": { "sku": "SKU-1", "product": {}, "supplier": {}, "offer": {}, "gates": {} } }
```

or stored catalog references:

```json
{ "pushQueueId": "PUSH-1" }
```

The endpoint returns `409` with blockers when publishing authorization fails. It returns a Shopify `productSet` draft plan when the SKU is publish-safe.
