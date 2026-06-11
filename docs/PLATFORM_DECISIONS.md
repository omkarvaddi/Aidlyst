# Aidlyst Platform Decisions

Prepared: 2026-06-11

## Decisions Confirmed

- Vercel is the main platform target for the public app and production deploy flow.
- Stripe is the preferred path for C-corp/payment infrastructure and future marketplace payouts.
- Worcester is the launch wedge. Start with local independent clinics, podiatry, PT, urgent care, wound care, and OTC consumables.
- Lawyer and technical/business advisor selection is in progress.
- Work should happen on a `codex/**` branch, not directly on protected `main`.

## Do We Still Need Shopify?

Not for the long-term Vercel + Stripe target.

Keep Shopify only if it is useful as a short-term bridge for product administration, existing theme assets, draft products, or an already-working checkout fallback. Do not use Shopify as the system of record for Aidlyst's compliance logic because it does not model the core requirements: UDI/GUDID identity, FDA establishment verification, supplier authorization evidence, eligibility registers, suppression SLOs, Rx buyer verification, audit trails, or B2B routing.

The target replacement is:

- Vercel hosts the app and API surfaces.
- Supabase stores product, supplier, compliance, order, audit, and account data.
- Stripe handles payment collection, webhooks, refunds, and later Connect payouts.
- Cloudflare protects public traffic with DNS, WAF, bot controls, and rate limits.

## Stripe Scope

Stripe can cover:

- Atlas or related business setup workflows, subject to legal/accounting review.
- Checkout Sessions for simple hosted checkout.
- PaymentIntents for custom checkout where needed.
- Webhooks for reliable order/payment state.
- Connect Accounts v2 for supplier payouts when Aidlyst becomes a true marketplace.

Stripe does not replace:

- product catalog
- FDA/GUDID verification
- supplier onboarding
- inventory availability
- Rx buyer verification
- HIPAA/privacy controls
- order fulfillment operations
- legal classification and licensing work

## Vercel Scope

Vercel should become the default place for:

- web app hosting
- preview deployments for every branch/PR
- production deployments from protected `main`
- environment variable management by environment
- server functions/API routes where the app needs first-party backend logic
- security headers and deployment checks

Sensitive Vercel environment variables must be production/preview scoped and marked sensitive where possible. Any variable prefixed `NEXT_PUBLIC_` is browser-visible and must never contain a private credential.

## Cloudflare Scope

Cloudflare remains useful even with Vercel:

- authoritative DNS
- WAF rules
- rate limiting
- bot controls
- DDoS protection
- `api.aidlyst.com` edge gateway if it remains the best credential boundary

One caution: when Cloudflare proxies Vercel, make sure Vercel security products and bot controls still see the correct client IP and that domain verification remains intact. Test this before relying on both layers.

## Do We Still Need Lovable?

No, not as a production platform if Vercel is the main deployment platform.

Lovable can still be useful as a prototyping and product-design tool when the output is exported or synchronized into GitHub and reviewed like normal code. Do not treat Lovable as the source of truth for production security, secrets, database policy, checkout behavior, compliance gates, or deploy approvals.

Recommended role:

- Use Lovable for fast UI exploration, admin-screen drafts, and non-production product demos.
- Move accepted work into the GitHub repo.
- Review, test, and deploy through the Vercel/GitHub path.
- Keep secrets in Vercel, Supabase, Stripe, Cloudflare, GitHub, or a password manager, not in Lovable prompts or generated code.
- Do not connect real patient, payment, supplier, or admin credentials to a prototype workspace.

## Migration Order

1. Freeze new Shopify-first work.
2. Keep existing Shopify checkout gates in place as a safety fallback.
3. Create the Vercel app/deploy project.
4. Move public UI to Vercel preview/production.
5. Move checkout/payment paths to Stripe.
6. Move catalog/order system of record to Supabase.
7. Retire Shopify once no production path depends on it.
