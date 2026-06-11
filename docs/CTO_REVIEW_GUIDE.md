# Aidlyst CTO Review Guide

Prepared: 2026-06-11

## Purpose

This repo needs a technical reviewer to separate the legacy Shopify/theme state from the target Vercel/Supabase/Stripe product architecture. The immediate CTO job is not to admire the theme. It is to confirm the safest migration path and identify what must be hardened before real money, supplier data, clinic accounts, or regulated workflows touch production.

## Current Repo State

- `main` contains a legacy Shopify theme plus the `Friday/` tool.
- `docs/` now records the platform, security, and secret-handling decisions.
- A broken `aidlyst-shopify-theme` gitlink was removed because it had no `.gitmodules` mapping and broke clone/deploy flows.
- The target production app has not yet been fully merged into this GitHub repo.
- Existing code should be treated as transitional until CI, ownership, and deployment boundaries are explicit.

## Target Architecture

- Vercel: public app, preview deployments, production deploys, server/API routes where appropriate.
- Supabase: Postgres, Auth, RLS, audit data, approved operational records.
- Stripe: payments, webhooks, refunds, and later Connect payouts if the legal model supports marketplace behavior.
- Cloudflare: DNS, WAF, rate limits, bot controls, and optional edge gateway.
- GitHub: protected main, PR review, dependency updates, secret scanning, and deployment traceability.
- Shopify: temporary legacy bridge only.
- Lovable: optional prototype/design tool only; not the production source of truth.

## CTO Review Priorities

1. Confirm the app boundary: what remains legacy Shopify and what becomes the Vercel app.
2. Approve the first deployable Vercel app structure before more code lands.
3. Define the Supabase schema for products, suppliers, compliance decisions, orders, accounts, and audit events.
4. Require fail-closed public catalog and checkout authorization rules.
5. Verify all secrets are provider-managed and never committed.
6. Add CI for builds, tests, dependency audit, secret scanning, and migration checks.
7. Set an access model for founder, advisor, contractor, and future employee accounts.
8. Review the legal/product boundary before any Rx, PHI, marketplace payout, or hospital procurement workflow.

## Immediate Questions For CTO

- Should Aidlyst start as a request-for-quote workflow before enabling direct checkout?
- What is the minimum backend schema needed for the Worcester pilot?
- Which product classes are safe for OTC clinic-supply MVP scope?
- What data must be encrypted at application level versus database/provider level?
- Should Cloudflare proxy Vercel directly, or should Cloudflare protect only selected API/gateway surfaces?
- What logs are required for compliance and incident response, and how long should they be retained?
- What CI checks must block merge into `main`?

## Known Risks

- The repo still contains legacy Shopify-theme files, which may distract from the target architecture.
- Friday tooling is separate from the Aidlyst production app and should not be confused with MVP infrastructure.
- Production checkout must remain blocked until legal, supplier, insurance, and webhook controls are complete.
- Supabase service-role access must stay server-only.
- Lovable-generated code must be reviewed before it is trusted.
- No PHI should be stored until HIPAA/BAA scope is confirmed by counsel.

## Recommended First CTO Milestone

Create one deployable Vercel app PR with:

- Next.js or equivalent app scaffold.
- Supabase client/server boundary.
- Stripe webhook endpoint with signature verification.
- Health check route.
- Security headers.
- Environment variable schema.
- One protected admin route stub.
- One public safe catalog route that returns no unapproved records.
- CI checks that must pass before merge.
