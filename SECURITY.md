# Security Policy

## Reporting

Do not open public GitHub issues for vulnerabilities, exposed credentials, payment bugs, supplier impersonation, or health-data handling problems.

Report privately to the project owner through the agreed company security contact. Until a dedicated address exists, use a direct private channel with the founder and avoid including live secret values in the message.

## Handling Secrets

Never commit real values for:

- Stripe secret keys or webhook secrets
- Supabase service-role keys, JWT secrets, database passwords, or direct connection strings
- Cloudflare API tokens
- Vercel tokens
- GitHub tokens or deploy keys
- Shopify Admin credentials
- email provider keys
- private key files

If a secret is exposed, rotate it. Deleting it from the latest commit is not enough.

## Security Baseline

Before production traffic:

- MFA must be enabled on all admin accounts.
- `main` must remain protected.
- Pull requests must pass CI.
- Public checkout must authorize server-side.
- Public catalog rows must fail closed until approved.
- Supabase RLS must protect any browser-accessible table.
- Stripe webhooks must verify signatures and reject replayed or malformed events.
- Cloudflare/Vercel edge protections must be configured for public routes.
- No PHI should be collected until legal/HIPAA scope is confirmed.

## Backend Exposure Rules

- Local backend runs bind to `127.0.0.1` by default.
- Production-like backend runs must set `AIDLYST_BACKEND_API_KEY`.
- Development login routes must stay disabled in production-like environments.
- The public website must not receive `AIDLYST_BACKEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, or any equivalent privileged value.
- Browser code may use only intentionally public `NEXT_PUBLIC_*` values.
