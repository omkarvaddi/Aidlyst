# Aidlyst National Healthcare Database Plan

Updated: 2026-06-05

## Objective

Build the backend data layer behind the Aidlyst promises shown on the homepage:

- Verified suppliers: every supplier/manufacturer record must have source provenance, regulatory identifiers, verification status, and evidence.
- Real-time inventory: inventory is only "real-time" after a live supplier feed is active, monitored, and timestamped.
- Localized B2B: hospitals, clinics, suppliers, manufacturers, pharmacies, and labs need normalized locations, identifiers, and match scores.
- Doctor-fit: product recommendations need clinician/pharmacist review records and specialty/taxonomy fit.
- Curated catalog: products remain candidates until supplier, compliance, evidence, and review gates pass.
- Compliance-first: no PHI, no patient records, no unsupported FDA approval/certification language, and no public exposure until explicit policy allows it.
- Data moat: durable depth belongs on the supplier/manufacturer side; customer product-fit data is short-lived by default and durable only after explicit opt-in.

## Current Backend State

The existing backend already handles product sourcing, supplier offers, commerce routing, checkout authorization, Shopify draft planning, audit records, and idempotent decisions.

The new schema foundation in `backend/db/schema.sql` adds the national database layer:

- `data_sources`
- `data_ingestion_runs`
- `national_healthcare_entities`
- `entity_locations`
- `entity_external_identifiers`
- `entity_source_records`
- `entity_relationships`
- `healthcare_facility_profiles`
- `manufacturer_profiles`
- `supplier_verification_profiles`
- `supplier_lead_research_runs`
- `supplier_lead_records`
- `supplier_contact_points`
- `supplier_deals`
- `supplier_outreach_drafts`
- `supplier_meeting_packets`
- `supplier_people`
- `supplier_relationship_events`
- `supplier_source_evidence`
- `supplier_score_snapshots`
- `supplier_contract_terms`
- `supplier_compliance_documents`
- `supplier_export_logs`
- `regulatory_product_records`
- `inventory_feeds`
- `inventory_snapshots`
- `localized_b2b_matches`
- `clinical_fit_reviews`
- `customer_consent_events`
- `customer_sessions`
- `customer_preference_cache`
- `customer_saved_preferences`
- `customer_recommendation_events`
- `privacy_redaction_events`
- `customer_data_deletion_requests`
- `customer_profile_compilations`
- `data_quality_findings`

All target Supabase tables now have RLS enabled. Only `service_role` receives table grants in the schema. Browser/public access should go through backend or Edge Function APIs, not direct table reads.

## Reality Check

There is no single official feed that contains every hospital, every clinic, every medical manufacturer, every pharmaceutical manufacturer, live inventory, and verification status.

Aidlyst needs a layered database:

1. Official government seed sources for broad coverage.
2. Deduplication and entity resolution to merge records from multiple agencies.
3. Partner or commercial sources for data that is not reliably public, especially inventory and supplier terms.
4. Internal verification workflows for supplier status, contracts, return policies, seller-of-record readiness, and doctor-fit.
5. Ongoing refresh jobs, audit trails, and data-quality reviews.

## Official Source Map

| Coverage Need | Initial Source | Backend Tables | Notes |
| --- | --- | --- | --- |
| National provider and organization identifiers | CMS NPPES NPI downloadable files: https://download.cms.gov/nppes/NPI_Files.html | `national_healthcare_entities`, `entity_external_identifiers`, `entity_locations`, `entity_source_records` | Use V2 monthly full replacement plus weekly increments. NPI issuance does not validate licensure or credentialing. |
| Hospital facility records | CMS Hospital General Information: https://data.cms.gov/provider-data/dataset/xubh-q36u | `national_healthcare_entities`, `healthcare_facility_profiles`, `entity_locations`, `entity_external_identifiers` | Source for CCN/facility ID, address, ownership, hospital type, emergency services, and ratings. |
| Federally funded clinics and health centers | HRSA Health Center Service Delivery Sites: https://data.hrsa.gov/topics/health-centers | `national_healthcare_entities`, `healthcare_facility_profiles`, `entity_locations`, `entity_external_identifiers` | Strong clinic seed, not a complete universe of every private clinic. |
| Clinical labs | CMS Provider of Services File - Clinical Laboratories: https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/provider-of-services-file-clinical-laboratories | `national_healthcare_entities`, `healthcare_facility_profiles`, `entity_external_identifiers` | Adds CLIA-related lab coverage. |
| Medical device manufacturers and listed devices | FDA Device Establishment Registration and Listing downloads: https://www.fda.gov/medical-devices/device-registration-and-listing/establishment-registration-and-medical-device-listing-files-download | `national_healthcare_entities`, `manufacturer_profiles`, `regulatory_product_records`, `entity_external_identifiers` | FDA device registration/listing is not approval, clearance, authorization, or certification. |
| Drug/pharmaceutical establishments | FDA Drug Establishments Current Registration Site: https://www.fda.gov/drugs/drug-approvals-and-databases/drug-establishments-current-registration-site | `national_healthcare_entities`, `manufacturer_profiles`, `entity_external_identifiers`, `entity_source_records` | Daily/current drug establishment registration surface. |
| Device identifiers | AccessGUDID downloads: https://accessgudid.nlm.nih.gov/download | `regulatory_product_records`, `entity_external_identifiers`, `entity_source_records` | Daily device identifier records. |
| Drug product and NDC records | openFDA NDC download: https://open.fda.gov/apis/drug/ndc/download/ | `regulatory_product_records`, `entity_external_identifiers` | Download all files for a complete current set. |
| Live inventory | Partner APIs, EDI feeds, approved CSV drops, Shopify supplier feeds | `inventory_feeds`, `inventory_snapshots` | Not solved by public government data. Must be contracted or partner-provided. |

## Entity Model

Every organization goes into `national_healthcare_entities` with one durable Aidlyst ID.

Identifiers are stored separately in `entity_external_identifiers` so one entity can have many IDs:

- NPI
- CCN or CMS facility ID
- CLIA number
- FDA FEI
- FDA registration number
- FDA owner/operator number
- FDA labeler/NDC labeler code
- GUDID labeler DUNS
- HRSA site ID
- SAM UEI
- state license
- taxonomy code

Locations are stored in `entity_locations`, not directly on the entity, because one health system, clinic group, manufacturer, or supplier may have many locations.

Source payloads are retained in `entity_source_records` with hashes and ingestion run IDs. This is the audit path for disputes, stale data, and record merges.

## Ingestion Architecture

### Stage 1: Source Registry

Seed `data_sources` with official sources and mark each as `planned`, `active`, `paused`, or `retired`.

Required fields:

- source URL
- owner agency
- refresh cadence
- public/restricted data classification
- PHI flag
- last checked timestamp
- notes on source limitations

### Stage 2: Raw Ingestion

Every run writes a `data_ingestion_runs` row:

- source ID
- run type: full refresh, incremental, backfill, manual review, or webhook
- source file date and URL
- row counts
- checksum
- status
- error summary

For large files, ingest into temporary staging tables or object storage first, then upsert normalized tables. NPPES full replacement files are large enough that the job must stream rather than load the whole CSV into memory.

### Stage 3: Normalization

Normalize each raw record into:

- entity
- identifiers
- locations
- profile table, if relevant
- source record

Normalization rules:

- Uppercase and trim identifiers.
- Normalize names for matching, but preserve legal/display names.
- Keep Type 2 NPI organizations as business entities.
- Treat Type 1 NPI people as restricted professional records; use only where doctor-fit or taxonomy analysis requires it.
- Never treat NPI as licensure, credentialing, or supplier verification.
- Never treat FDA registration as FDA approval.

### Stage 4: Entity Resolution

Match entities with deterministic keys first:

- NPI
- CCN
- CLIA
- FDA FEI
- FDA registration number
- HRSA site ID
- NDC labeler code
- GUDID labeler DUNS

Then use conservative fuzzy matching:

- normalized legal name
- DBA/name aliases
- address
- city/state/ZIP
- phone/domain when available
- parent/owner/operator relationships

Low-confidence matches become `entity_relationships.relationship_type = 'possible_match'` and `data_quality_findings` rows, not automatic merges.

### Stage 5: Verification and Supplier Readiness

Supplier/manufacturer records are not "verified suppliers" until `supplier_verification_profiles` reaches at least `document_checked`.

Verification gates:

- official source record exists
- identity matched across at least one reliable identifier or manually reviewed
- FDA registration/listing language reviewed for accuracy
- return policy reviewed
- fulfillment path reviewed
- seller-of-record boundary reviewed
- insurance/product-liability review tracked when direct sale is contemplated
- compliance review complete
- no blockers in `supplier_verification_profiles.blockers`

Only `verification_level = 'live_feed_verified'` can support "real-time inventory" language.

### Stage 5A: Supplier Intelligence Graph

Supplier and manufacturer metadata is a restricted, durable operating asset.

Use supplier intelligence tables to store:

- public business contacts and people maps
- source evidence and confidence
- outreach drafts and relationship history
- deal thesis and stage
- scoring snapshots
- contract and transaction-fee terms
- compliance-document status
- export logs for restricted data

People metadata must stay business-contextual. Store role, authority, public business contact routes, objections, next steps, and relationship status. Do not store personal-life dossiers or private contact information unless provided for business use.

### Stage 6: Inventory

Inventory is partner data, not government data.

Each feed uses `inventory_feeds`:

- feed type
- connection status
- terms status
- SLA minutes
- last success/failure timestamps
- non-secret config only

Each stock check writes `inventory_snapshots`:

- supplier
- product candidate or regulatory product
- SKU/GTIN/NDC/UDI
- location/ZIP
- quantity
- availability
- unit price
- captured and expiry timestamps

Website claim rule:

- If no active feed exists, use "supplier availability checks" or "timestamped inventory snapshots."
- Use "real-time inventory" only after active supplier feeds have passed monitoring for the relevant catalog slice.

### Stage 7: Localized B2B Matching

Use `localized_b2b_matches` to score supplier/product fit for a hospital, clinic, or buyer ZIP.

Score inputs:

- distance/location score
- inventory score
- compliance score
- supplier verification score
- doctor-fit score
- price/lead-time score
- relationship or contract preference

Do not show localized recommendations publicly until the match includes source evidence and a non-expired inventory or availability signal.

### Stage 8: Doctor-Fit Review

Use `clinical_fit_reviews` for doctor/pharmacist/specialty review.

Required review fields:

- product candidate
- review scope
- reviewer role
- specialty or taxonomy code
- recommendation
- rationale
- evidence links
- review expiration

Doctor-fit output is advisory, not medical advice. Copy must avoid patient-specific treatment recommendations.

### Stage 9: Customer Preference Privacy

Customer product-fit data uses a different model from supplier intelligence.

Default state:

- Guest search and recommendation context is short-lived.
- Cache rows require expiry timestamps.
- Raw health narratives are not allowed in recommendation cache.
- Redaction events record the action taken without retaining raw sensitive content.

Opt-in state:

- Durable saved preferences require explicit consent.
- Consent is scoped and revocable.
- Profile compilation stores derived product preference tags, not diagnosis or treatment narratives.
- Deletion and withdrawal requests are tracked.

Personalization must never bypass product, supplier, labeling, compliance, review, or checkout gates.

## Build Phases

### Phase 0: Backend Foundation

Status: schema foundation added.

Deliverables:

- National entity schema in Supabase/Postgres target.
- Source registry seed rows.
- RLS enabled for all target tables.
- Service-role-only table grants.
- Regression test that locks required schema coverage.

### Phase 1: MVP Public Directory Seed

Timeline: 1-2 weeks.

Deliverables:

- NPPES V2 full-file importer for Type 2 organizations.
- CMS Hospital General Information importer.
- HRSA Health Center Service Delivery Sites importer.
- Entity/location/identifier normalization.
- Basic dedupe by deterministic IDs.
- Data-quality findings for missing identifiers and address conflicts.
- Internal search endpoint for `hospital`, `clinic`, `health_center`, `provider_group`.

Exit criteria:

- Backend can answer "find hospitals/clinics near ZIP" from normalized records.
- Every returned row has source provenance.
- No claim of complete national coverage yet.

### Phase 2: Manufacturer and Product Regulatory Layer

Timeline: 2-4 weeks after Phase 1.

Deliverables:

- FDA device establishment/listing importer.
- FDA DECRS drug establishment importer.
- AccessGUDID importer.
- openFDA NDC importer.
- Manufacturer profiles and regulatory product records.
- FDA-language guardrails in copy and API responses.

Exit criteria:

- Backend can distinguish source-seen manufacturer, FDA-registered establishment, listed device, NDC product, and Aidlyst-verified supplier.
- Homepage can safely say "FDA registration/listing checked where applicable" only for records with evidence.

### Phase 3: Supplier Verification Workflow

Timeline: 2-3 weeks.

Deliverables:

- Admin workflow for supplier verification profiles.
- Evidence upload/linking.
- Blocker tracking.
- Contract/terms state.
- Direct-sales readiness integration with existing checkout gate.
- Public catalog gate tied to verified supplier and approved product candidates.

Exit criteria:

- A supplier cannot appear as verified unless verification fields and evidence exist.
- Checkout/direct fulfillment remains blocked unless existing commerce gates pass.

### Phase 4: Inventory and Localized B2B

Timeline: 4-8 weeks, depends on supplier access.

Deliverables:

- Partner feed contracts or test feeds.
- Feed ingestion jobs.
- Inventory snapshots with expiry.
- Supplier SLA monitoring.
- Localized matching endpoint.
- Zip/county lookup and distance scoring.

Exit criteria:

- At least one supplier has an active monitored feed.
- Localized B2B match output includes evidence, distance, inventory freshness, and compliance score.
- "Real-time inventory" language is limited to supplier/product scopes with active feeds.

### Phase 5: Doctor-Fit and Curated Catalog

Timeline: parallel with Phases 2-4.

Deliverables:

- Clinical/pharmacist review queue.
- Review expiration.
- Product/category specialty mapping.
- Doctor-fit scoring.
- Catalog curation rules.

Exit criteria:

- Product recommendations show review status and are blocked when review expires or conflicts with compliance rules.

## API Surface Needed

Add these backend routes after the schema is deployed:

- `GET /v1/directory/entities`
- `GET /v1/directory/entities/:id`
- `GET /v1/directory/search?kind=&zip=&radius=`
- `GET /v1/directory/manufacturers?kind=&verified=`
- `POST /v1/directory/ingest/:sourceId`
- `GET /v1/directory/ingestion-runs`
- `POST /v1/suppliers/:entityId/verification`
- `GET /v1/inventory/snapshots?supplier=&sku=&zip=`
- `POST /v1/inventory/feeds/:feedId/check`
- `POST /v1/b2b/match`
- `POST /v1/clinical-fit/reviews`
- `POST /v1/customer/consent`
- `POST /v1/customer/preferences/cache`
- `POST /v1/customer/preferences/save`
- `POST /v1/customer/preferences/delete`
- `POST /v1/privacy/redactions`
- `GET /v1/supplier-intelligence/leads`
- `POST /v1/supplier-intelligence/events`
- `POST /v1/supplier-intelligence/export-log`

These should be protected by role. Public storefronts should receive only curated, safe aggregates.

## Compliance Rules

- Do not ingest PHI.
- Do not store patient-level records.
- Treat NPPES Type 1 records as professional public data with privacy risk, not general marketing data.
- Do not use user-editable metadata for authorization.
- Do not expose raw source records to customers.
- Do not expose supplier scoring weights, contract terms, private notes, or raw evidence files to customers.
- Do not store raw customer health narratives in analytics, recommendation cache, or saved preferences.
- Durable customer personalization requires explicit opt-in and a deletion path.
- Guest customer preference cache must expire.
- Do not claim FDA approval, clearance, authorization, certification, or endorsement from registration/listing alone.
- Keep FDA, NPI, CLIA, and CMS source limitations visible in internal review surfaces.
- Run legal/compliance review before using a source for outreach, resale, or public display.

## Definition of Done

The backend is ready to support the homepage claims only when:

- Every public entity row has source provenance.
- Every supplier marked verified has a verification profile and evidence.
- Every inventory claim has a live or fresh inventory snapshot with expiry.
- Every localized recommendation has a distance/locality score and evidence.
- Every doctor-fit recommendation has a non-expired clinical/pharmacist review.
- Every public endpoint filters out blocked, stale, unverified, and PHI-risk records.
- Backend tests cover schema presence, ingestion normalization, dedupe, RLS boundary, and route behavior.
