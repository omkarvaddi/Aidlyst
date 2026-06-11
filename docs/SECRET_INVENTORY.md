# Aidlyst Secret Inventory

Prepared: 2026-06-11

## What "Secrets" Means

A secret is any value that lets someone access, modify, deploy, read private data, move money, impersonate Aidlyst, or bypass a security gate. If an attacker gets it, they can do damage without needing your password.

Do not paste real secret values in chat, screenshots, GitHub, Obsidian, Google Docs, Slack, email, or `.env` files committed to git.

## High-Risk Secrets

Rotate immediately if exposed:

- GitHub personal access tokens and deploy keys
- Vercel tokens, org IDs when paired with tokens, project deploy tokens
- Cloudflare API tokens and account-level credentials
- Supabase service role key, JWT secret, database password, direct connection string
- Stripe secret key, webhook signing secret, restricted keys, Connect secrets
- Shopify Admin token and private app credentials
- `AIDLYST_INTERNAL_API_KEY`, `AIDLYST_BACKEND_API_KEY`, encryption keys
- Google Cloud API keys with broad permissions
- Resend/API email keys
- Sentry/Axiom tokens that allow data export or project admin access
- private key files such as `.pem`, `.key`, `.p8`, `.p12`

## Public Config That Is Not Secret

These may be browser-visible if correctly scoped, but should still be reviewed:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

The Supabase anon key is not a service-role key. It is designed for browser use, but it is only safe when RLS and policies are correct.

## Required Target Variables

Vercel production/preview:

- `DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `AIDLYST_INTERNAL_API_KEY`
- `AIDLYST_ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `FDA_OPENAPI_KEY`
- `SENTRY_DSN`
- `AXIOM_TOKEN`

Cloudflare Worker bridge, if retained:

- `SHOPIFY_SHOP_DOMAIN`
- `SHOPIFY_STOREFRONT_ACCESS_TOKEN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AIDLYST_INTERNAL_API_KEY`

Legacy Shopify values should not be added to new Vercel client code.

## Storage Rules

- Local development: `.env.local`, `.dev.vars`, or provider CLI secret stores only.
- Vercel: Environment Variables by environment; mark sensitive where possible.
- Cloudflare: `wrangler secret put`, not `wrangler.toml`.
- Supabase: dashboard secrets/Vault for database-side secrets.
- GitHub Actions: repository or environment secrets only.
- Password manager: account credentials, recovery codes, and shared operational secrets.

## Rotation Rules

Rotate a secret when:

- it was pasted into chat, email, Slack, Docs, or screenshots
- it was committed to git, even if later deleted
- a contractor/advisor no longer needs access
- a laptop/account may be compromised
- provider logs show suspicious usage
- a service changes owner or production project

For payment, database, and deploy credentials, rotation means revoke old, create new, deploy new value, verify, then delete old. Do not just rename the variable.
