# Aidlyst

Aidlyst is a compliance-gated medical device commerce project. The current GitHub repo contains the Shopify-theme era of the product plus Friday tooling; the working Codex environment also contains newer backend, gateway, local-preview, and planning work that should be merged through focused PRs instead of one large dump.

## Current Direction

As of 2026-06-11, Vercel is the primary target for the public web app and production deployment flow. Stripe is the target for company/payment infrastructure: Stripe Atlas where approved by counsel/accounting, Stripe Checkout or PaymentIntents for payments, and Stripe Connect for future supplier payouts. Shopify is no longer the default long-term platform; keep it only as a temporary catalog/admin/checkout bridge until the Vercel + Stripe path fully replaces it.

Target platform responsibilities:

- Vercel: public web app, preview deployments, server/API functions where appropriate, production deploy workflow.
- Supabase: Postgres, Auth, RLS, audit-friendly data layer, storage for approved operational documents.
- Stripe: Atlas, payments, webhooks, refunds, and later marketplace payout flows through Connect.
- Cloudflare: DNS, WAF/rate limits/bot controls, and edge gateway where it protects private service calls.
- GitHub: protected-main workflow, `codex/**` branches, CI, Dependabot, secret scanning, PR review.
- Shopify: legacy bridge only; do not build new core business logic around it.

## Repo Hygiene Rules

- Keep `main` protected.
- Use `codex/**` branches for Codex work.
- Stage narrow, logical PRs.
- Do not commit `.env`, `.env.local`, `.dev.vars`, Vercel project files, private keys, or provider tokens.
- Treat checkout as blocked until server-side authorization, legal review, insurance, supplier agreements, and payment webhooks are ready.

## Current Docs

- `docs/PLATFORM_DECISIONS.md`: Vercel, Stripe, Shopify, Supabase, Cloudflare roles.
- `docs/SECRET_INVENTORY.md`: what secrets are, where they belong, and when to rotate.
- `docs/SECURITY_AND_LAUNCH_PLAN.md`: immediate security and Worcester-first launch order.
- `docs/CTO_REVIEW_GUIDE.md`: current repo state, known gaps, and first CTO review questions.

## CTO Review Entry Point

Start with `docs/CTO_REVIEW_GUIDE.md`, then review `docs/SECURITY_AND_LAUNCH_PLAN.md` and `docs/PLATFORM_DECISIONS.md`.

The repo is intentionally in a transition state:

- The root contains the legacy Shopify theme and Friday tooling already on `main`.
- The target architecture is Vercel + Supabase + Stripe.
- `backend/` now contains the local control-plane backend for compliance gating, routing, audit records, and checkout authorization.
- New production app work should land as focused PRs, not as one unreviewable import.
- The previous broken `aidlyst-shopify-theme` gitlink has been removed because it had no `.gitmodules` entry and broke clean clone/deploy flows.

## Backend

The backend is in `backend/`. It is a dependency-light Node service that can run locally without provider credentials and is designed to move toward Supabase/Postgres plus Vercel/server infrastructure.

```powershell
cd backend
npm run check
npm test
npm start
```

Security defaults:

- local runs bind to `127.0.0.1` by default
- generated backend data is ignored under `backend/data/`
- production-like runs require `AIDLYST_BACKEND_API_KEY`
- development login routes are disabled in production-like environments
- private backend endpoints reject unauthenticated requests when protected mode is enabled

## Immediate Verification Targets

The next code PRs should add or expand CI for:

- secret scanning
- gateway syntax/tests when gateway is merged
- Vercel preview build once the web app is created
- dependency audit and Dependabot
