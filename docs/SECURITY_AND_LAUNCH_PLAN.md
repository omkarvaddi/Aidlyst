# Aidlyst Security And Launch Plan

Prepared: 2026-06-11

This plan combines the Drive security assessment, developer build plan, legal plan, Worcester targets, COO playbook, competitive analysis, financial model, pitch deck, and the current local repo state.

## Immediate Lockdown

Do these before real traffic, real orders, or PHI:

1. Enable MFA on GitHub, Vercel, Cloudflare, Supabase, Stripe, Google Workspace, Shopify, Lovable, and email/admin accounts.
2. Move all business communication to company-controlled `@aidlyst.com` accounts.
3. Configure SPF, DKIM, and DMARC for `aidlyst.com`; progress to DMARC `p=reject` after monitoring.
4. Run repo secret scanning, including git history; rotate anything found.
5. Put Cloudflare WAF, managed rules, bot controls, and rate limits in front of public routes.
6. Keep public checkout blocked until legal, insurance, supplier agreements, and server-side authorization are complete.

## Build Order

1. Repo hygiene: branch, CI, `.gitignore`, secret scan, README/docs, protected main.
2. Vercel foundation: project, preview deploys, production env separation, headers, deploy checks.
3. Supabase schema: migrate from file-backed control plane to Postgres, enable RLS and audit protections.
4. Public API: expose only approved catalog rows and safe aggregates.
5. Stripe payments: start with hosted Checkout for approved checkout-safe rows; add Connect only when supplier payout/legal structure is ready.
6. Supplier verification: no auto-approval from FDA number alone; require proof of authorization and official callback.
7. Worcester launch CRM: build 50+ target records and start with 10 Tier-A clinics.
8. Compliance engine: GUDID/FDA checks, eligibility register, suppression queue, fail-closed catalog/routing.
9. B2B matching: ZIP validation, PostGIS routing, landed-cost quotes.
10. Prescribed channel: only after HIPAA, BAAs, buyer verification, and Rx controls are ready.

## Worcester First Wedge

Start local with independent practices that can decide quickly:

- podiatry
- physical therapy
- urgent care
- wound care / diabetic care
- independent primary care

Skip UMass Memorial and Saint Vincent system-owned departments until Aidlyst has proof, because GPO/system contracts make them slow first targets.

First month target:

- 5 founding clinics
- 50 to 100 OTC clinic-supply product records
- 1 to 3 supplier/distributor paths
- no Rx-only checkout
- no PHI storage beyond approved temporary/minimized flows

## Legal Gates

Counsel must decide before launch:

- whether Aidlyst is a marketplace, distributor, retailer, or Rx dispenser for each channel
- Massachusetts DME/device licensing requirements
- multi-state expansion licensing
- Rx-only listing and buyer verification rules
- HIPAA Business Associate status and BAA needs
- required policies: Terms, Privacy, WISP, Supplier Agreement, Returns, breach response, adverse-event reporting
- insurance: general liability, product/marketplace liability, cyber, E&O, D&O

## Security Gates For MVP

MVP is not production-ready until:

- all admin accounts have MFA
- no private secrets are in git or docs
- Vercel and Cloudflare environments are separated
- Supabase service role never reaches the browser
- RLS is enabled where browser/client access exists
- audit logs are append-only
- ZIP inputs are strictly validated before geocoding
- supplier webhooks are HMAC signed with replay protection
- public catalog excludes unapproved records
- checkout authorizes server-side and writes an audit event
- WAF/rate limits are active
- security headers are present
- external pentest is scheduled before real PHI or hospital procurement workflows
