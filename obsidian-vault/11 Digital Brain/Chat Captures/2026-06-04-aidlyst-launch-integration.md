# 2026-06-04 Aidlyst Launch Integration Chat Capture

Tags: #workflow #shopify #data #compliance #supabase #cloudflare #slack

## Context

User asked Codex to move the Aidlyst launch stack forward across GitHub, Supabase, Shopify, Slack, Cloudflare, supplier datasets, and Obsidian learning. Website hosting is Lovable. Shopify owns inventory, product, and domain. Supabase is connected. Cloudflare still needs implementation.

This capture was written to the remote `obsidian-sync` branch because the local Codex workspace was read-only during the session.

## Done

- Created GitHub PR #7 to merge `codex/catalog-comparison-tools` into protected `main`.
- Created remote GitHub branch `obsidian-sync` from current GitHub `main`.
- Deployed Supabase control-plane schema migrations for product candidates, suppliers, supplier offers, commerce decisions, Shopify push queue, evidence, audit events, draft plans, and idempotency.
- Added missing foreign-key indexes for the new Shopify push queue table.
- Deployed Supabase event tracking schema for storefront/event telemetry.
- Deployed Supabase Edge Function `track-event` with endpoint `https://ylurrwjyimygfwhdpoiz.supabase.co/functions/v1/track-event`.
- Updated PR #7 body with the exact merge blocker and storefront decision required.

## Verified

- Supabase migrations present: `aidlyst_control_plane_schema`, `aidlyst_control_plane_fk_indexes`, `aidlyst_event_tracking_schema`.
- Supabase Edge Function `track-event` is ACTIVE, version 1, `verify_jwt=false` by design because it is a public storefront endpoint with custom validation.
- New control-plane and event tables have RLS enabled and force RLS enabled.
- GitHub reports PR #7 open, not merged, and `mergeable=false`.

## Not Verified

- Live POST invocation to `track-event` was not verified in this session.
- Shopify theme setting for the Supabase event endpoint was not configured because no Shopify Admin connector or token was available.
- Slack app and Cloudflare Worker deployment were not completed because Slack app credentials and Cloudflare deployment access were not available.
- Local file edits and local test commands were blocked by read-only workspace restrictions.

## Decision Required

PR #7 cannot be blindly merged. Current `main` uses `sections/aidlyst-home-experience.liquid` for the homepage and `sections/aidlyst-products-disabled.liquid` for product pages. The catalog branch introduces `sections/aidlyst-premium-home.liquid` and restores a product template with supplier comparison and buy-button blocks.

Before resolving conflicts, confirm whether Aidlyst should:

1. Keep product pages disabled until pharmacist and medical advisor gates are live.
2. Replace the disabled product template with the catalog product template now.
3. Use a hybrid path: keep product pages non-transactional, add supplier comparison/link UI, and suppress direct Shopify checkout until compliance gates are approved.

Recommended default: hybrid path. Shopify can own inventory/product/domain while Aidlyst keeps server-side gating and avoids premature medical-commerce risk.

## Durable Lessons

- Treat protected `main` storefront conflicts as product/compliance decisions, not only git conflicts.
- For medical and OTC products, direct checkout must remain gated until named pharmacist and medical advisor review workflow exists.
- Supabase service-only control-plane tables should keep RLS and force RLS enabled with no broad client policies.
- Public storefront event endpoints can use `verify_jwt=false` only when the function body implements size limits, event allow-listing, payload minimization, and safe CORS behavior.
- The remote `obsidian-sync` branch was created from GitHub `main`, which did not contain the local untracked Obsidian vault files. Future sync work needs a clean branch strategy for vault files.

## Follow-Ups

- Resolve PR #7 after the product-page decision is confirmed.
- Add Shopify theme setting/wiring for `track-event` and verify a live event reaches Supabase.
- Create/deploy Slack-to-Obsidian bridge through Cloudflare once secrets are available.
- Define the named pharmacist and medical advisor review workflow before pushing medical product records into Shopify.
- Add approved supplier feed/API/vendor quote inputs before populating Supplier Offer Rates.
- Build real Shopify Admin API draft push script with `productSet` and `metafieldsSet` after approved queue rows exist.
