-- Aidlyst commerce control-plane schema.
-- Target: Postgres/Supabase. Local development currently uses file-backed stores.

create table if not exists policy_versions (
  id text primary key,
  description text not null,
  rules_hash text not null,
  effective_at timestamptz not null default now(),
  retired_at timestamptz
);

create table if not exists product_candidates (
  id text primary key,
  name text not null,
  category text,
  subcategory text,
  product_type text,
  otc_status text,
  regulatory_path text,
  fda_device_class text,
  fda_product_code text,
  rx_or_restricted_flag boolean not null default false,
  intended_use_source text,
  claim_risk text not null default 'medium',
  pharmacist_recommended_status text,
  pharmacist_reviewer text,
  medical_advisor_required boolean not null default true,
  medical_advisor_status text,
  commerce_mode_recommendation text,
  evidence_summary text,
  source_links text,
  status text not null default 'candidate',
  owner text,
  source text,
  confidence text,
  last_updated timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_candidates_claim_risk_check check (claim_risk in ('low', 'medium', 'high', 'prohibited', 'prohibited_for_launch')),
  constraint product_candidates_status_check check (status in ('candidate', 'review', 'approved', 'blocked', 'do_not_list', 'rejected', 'retired'))
);

create table if not exists suppliers (
  id text primary key,
  name text not null,
  type text not null,
  category_focus text,
  monetization_fit text,
  risk_level text,
  status text not null default 'prospect',
  owner text,
  source text,
  confidence text,
  last_updated timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists supplier_offers (
  id text primary key,
  product_candidate_id text not null references product_candidates(id),
  supplier_id text not null references suppliers(id),
  name text,
  supplier_sku text,
  gtin text,
  offer_url text,
  affiliate_url text,
  currency text not null default 'USD',
  item_price numeric(12,2),
  shipping_estimate numeric(12,2),
  total_landed_cost numeric(12,2),
  commission_rate numeric(8,4),
  commission_type text,
  availability text,
  moq integer,
  lead_time text,
  return_policy_summary text,
  rate_source text,
  source_url text,
  last_checked timestamptz,
  winner_status text,
  owner text,
  source text,
  confidence text,
  last_updated timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shopify_push_queue (
  id text primary key,
  product_candidate_id text not null references product_candidates(id),
  primary_offer_id text references supplier_offers(id),
  name text,
  shopify_handle text,
  shopify_product_id text,
  commerce_mode text not null,
  shopify_status text not null default 'draft',
  selected_price numeric(12,2),
  selected_affiliate_url text,
  required_metafields text,
  copy_status text,
  image_permission_status text,
  pharmacist_gate_status text,
  medical_advisor_gate_status text,
  compliance_gate_status text,
  ready_to_push boolean not null default false,
  pushed_at timestamptz,
  last_error text,
  owner text,
  source text,
  confidence text,
  last_updated timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_push_queue_commerce_mode_check check (commerce_mode in ('affiliate', 'lead_gen', 'retailer_checkout', 'manufacturer_direct', 'direct_fulfillment', 'do_not_list')),
  constraint shopify_push_queue_status_check check (shopify_status in ('draft', 'active', 'archived'))
);

create table if not exists direct_sales_readiness (
  product_candidate_id text primary key references product_candidates(id),
  seller_of_record_policy boolean not null default false,
  supplier_agreement boolean not null default false,
  return_refund_process boolean not null default false,
  shipping_fulfillment_process boolean not null default false,
  tax_collection_process boolean not null default false,
  product_liability_review boolean not null default false,
  product_safety_labeling_review boolean not null default false,
  insurance_review boolean not null default false,
  customer_support_workflow boolean not null default false,
  reviewed_by text,
  reviewed_at timestamptz,
  notes text
);

create table if not exists commerce_decisions (
  id uuid primary key,
  action text not null,
  sku text,
  product_candidate_id text references product_candidates(id),
  supplier_offer_id text references supplier_offers(id),
  policy_version_id text references policy_versions(id),
  input_hash text not null,
  evidence_hash text not null,
  route_mode text not null,
  risk_level text not null,
  publish_allowed boolean not null,
  checkout_allowed boolean not null,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id bigserial primary key,
  decision_id uuid not null references commerce_decisions(id) on delete cascade,
  event_type text not null,
  event_at timestamptz not null,
  sku text,
  payload jsonb not null
);

create table if not exists evidence_items (
  id bigserial primary key,
  decision_id uuid not null references commerce_decisions(id) on delete cascade,
  evidence_type text not null,
  url text,
  text text,
  summary text,
  source_url text,
  content_hash text,
  created_at timestamptz not null default now()
);

create table if not exists idempotency_keys (
  key text primary key,
  decision_id uuid not null references commerce_decisions(id),
  created_at timestamptz not null default now()
);

create table if not exists shopify_draft_plans (
  decision_id uuid primary key references commerce_decisions(id) on delete cascade,
  allowed boolean not null,
  product_set_payload jsonb,
  blockers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists supplier_offers_product_candidate_id_idx on supplier_offers(product_candidate_id);
create index if not exists supplier_offers_supplier_id_idx on supplier_offers(supplier_id);
create index if not exists supplier_offers_last_checked_idx on supplier_offers(last_checked);
create index if not exists shopify_push_queue_ready_idx on shopify_push_queue(ready_to_push, shopify_status);
create index if not exists commerce_decisions_sku_created_idx on commerce_decisions(sku, created_at desc);
create index if not exists commerce_decisions_route_risk_idx on commerce_decisions(route_mode, risk_level);
create index if not exists audit_events_decision_type_idx on audit_events(decision_id, event_type);
create index if not exists evidence_items_decision_type_idx on evidence_items(decision_id, evidence_type);

-- National healthcare entity database.
-- This layer is the Supabase/Postgres target for the nationwide provider,
-- facility, manufacturer, verification, inventory, and B2B matching graph.

create table if not exists data_sources (
  id text primary key,
  name text not null,
  owner_agency text,
  source_url text not null,
  dataset_type text not null,
  refresh_cadence text not null,
  source_authority text not null default 'official_government',
  pii_level text not null default 'public_business',
  hipaa_phi_allowed boolean not null default false,
  ingestion_status text not null default 'planned',
  notes text,
  last_checked_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_sources_dataset_type_check check (dataset_type in (
    'provider_directory',
    'facility_directory',
    'regulatory_registration',
    'regulatory_product',
    'inventory_feed',
    'commercial_partner',
    'manual_review',
    'other'
  )),
  constraint data_sources_authority_check check (source_authority in (
    'official_government',
    'official_partner',
    'commercial_partner',
    'manual_review',
    'internal'
  )),
  constraint data_sources_pii_level_check check (pii_level in (
    'public_business',
    'public_professional',
    'restricted_business',
    'contains_personal_data',
    'prohibited_phi'
  )),
  constraint data_sources_ingestion_status_check check (ingestion_status in ('planned', 'active', 'paused', 'retired'))
);

insert into data_sources (
  id,
  name,
  owner_agency,
  source_url,
  dataset_type,
  refresh_cadence,
  source_authority,
  pii_level,
  hipaa_phi_allowed,
  ingestion_status,
  notes
) values
  (
    'cms_nppes_npi_files',
    'NPPES NPI Downloadable Files',
    'Centers for Medicare & Medicaid Services',
    'https://download.cms.gov/nppes/NPI_Files.html',
    'provider_directory',
    'monthly full replacement plus weekly increments',
    'official_government',
    'public_professional',
    false,
    'planned',
    'Primary national seed for Type 2 organization providers and selected Type 1 clinician taxonomy signals. NPI issuance does not validate licensure or credentialing.'
  ),
  (
    'cms_hospital_general_information',
    'Hospital General Information',
    'Centers for Medicare & Medicaid Services',
    'https://data.cms.gov/provider-data/dataset/xubh-q36u',
    'facility_directory',
    'CMS Provider Data Catalog refresh',
    'official_government',
    'public_business',
    false,
    'planned',
    'Hospital facility seed for CCN, ownership, emergency services, ratings, address, and phone fields.'
  ),
  (
    'hrsa_health_center_service_sites',
    'Health Center Service Delivery Sites',
    'Health Resources and Services Administration',
    'https://data.hrsa.gov/topics/health-centers',
    'facility_directory',
    'daily',
    'official_government',
    'public_business',
    false,
    'planned',
    'Federally funded health center and look-alike service delivery sites for clinic coverage.'
  ),
  (
    'cms_clia_clinical_laboratories',
    'Provider of Services File - Clinical Laboratories',
    'Centers for Medicare & Medicaid Services',
    'https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/provider-of-services-file-clinical-laboratories',
    'facility_directory',
    'CMS public use file refresh',
    'official_government',
    'public_business',
    false,
    'planned',
    'Clinical laboratory demographics and CLIA-related facility characteristics.'
  ),
  (
    'fda_device_registration_listing',
    'FDA Device Establishment Registration and Listing',
    'U.S. Food and Drug Administration',
    'https://www.fda.gov/medical-devices/device-registration-and-listing/establishment-registration-and-medical-device-listing-files-download',
    'regulatory_registration',
    'weekly',
    'official_government',
    'public_business',
    false,
    'planned',
    'Medical device establishments and listed devices. FDA registration is not FDA approval, clearance, authorization, or certification.'
  ),
  (
    'fda_drug_establishments_decrs',
    'Drug Establishments Current Registration Site',
    'U.S. Food and Drug Administration',
    'https://www.fda.gov/drugs/drug-approvals-and-databases/drug-establishments-current-registration-site',
    'regulatory_registration',
    'business daily',
    'official_government',
    'public_business',
    false,
    'planned',
    'Currently registered drug establishments that manufacture, prepare, propagate, compound, or process drugs distributed in the U.S. or marketed for U.S. import.'
  ),
  (
    'accessgudid',
    'AccessGUDID Device Identifiers',
    'U.S. Food and Drug Administration / National Library of Medicine',
    'https://accessgudid.nlm.nih.gov/download',
    'regulatory_product',
    'daily',
    'official_government',
    'public_business',
    false,
    'planned',
    'Device identifier records for medical devices with UDIs.'
  ),
  (
    'openfda_ndc_directory',
    'openFDA National Drug Code Directory',
    'U.S. Food and Drug Administration',
    'https://open.fda.gov/apis/drug/ndc/download/',
    'regulatory_product',
    'download all files for full current set',
    'official_government',
    'public_business',
    false,
    'planned',
    'Drug product, package, labeler, route, marketing category, and NDC fields from openFDA downloads.'
  )
on conflict (id) do update set
  name = excluded.name,
  owner_agency = excluded.owner_agency,
  source_url = excluded.source_url,
  dataset_type = excluded.dataset_type,
  refresh_cadence = excluded.refresh_cadence,
  source_authority = excluded.source_authority,
  pii_level = excluded.pii_level,
  hipaa_phi_allowed = excluded.hipaa_phi_allowed,
  ingestion_status = excluded.ingestion_status,
  notes = excluded.notes,
  updated_at = now();

create table if not exists data_ingestion_runs (
  id text primary key,
  source_id text not null references data_sources(id),
  run_type text not null,
  status text not null default 'queued',
  source_version text,
  source_file_date date,
  source_download_url text,
  started_at timestamptz,
  completed_at timestamptz,
  rows_seen bigint not null default 0,
  rows_loaded bigint not null default 0,
  rows_rejected bigint not null default 0,
  checksum text,
  error_summary text,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_ingestion_runs_type_check check (run_type in ('full_refresh', 'incremental', 'backfill', 'manual_review', 'webhook')),
  constraint data_ingestion_runs_status_check check (status in ('queued', 'running', 'succeeded', 'failed', 'partial', 'cancelled'))
);

create table if not exists national_healthcare_entities (
  id text primary key,
  entity_kind text not null,
  legal_name text not null,
  display_name text,
  dba_name text,
  organization_type text,
  taxonomy_primary text,
  lifecycle_status text not null default 'unknown',
  verification_status text not null default 'unverified',
  risk_level text not null default 'unknown',
  source_confidence text not null default 'medium',
  primary_source_id text references data_sources(id),
  last_source_refresh_at timestamptz,
  last_verified_at timestamptz,
  normalized_name text,
  search_blob text,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint national_entities_kind_check check (entity_kind in (
    'hospital',
    'clinic',
    'health_center',
    'pharmacy',
    'laboratory',
    'medical_device_manufacturer',
    'drug_manufacturer',
    'pharmaceutical_manufacturer',
    'distributor',
    'retailer',
    'health_system',
    'provider_group',
    'other'
  )),
  constraint national_entities_lifecycle_check check (lifecycle_status in ('active', 'inactive', 'deactivated', 'unknown', 'merged', 'retired')),
  constraint national_entities_verification_check check (verification_status in ('unverified', 'source_seen', 'cross_checked', 'aidlyst_verified', 'blocked', 'do_not_use')),
  constraint national_entities_risk_check check (risk_level in ('low', 'medium', 'high', 'prohibited', 'unknown')),
  constraint national_entities_confidence_check check (source_confidence in ('low', 'medium', 'high'))
);

create table if not exists entity_locations (
  id text primary key,
  entity_id text not null references national_healthcare_entities(id) on delete cascade,
  location_kind text not null default 'primary',
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  county text,
  county_fips text,
  congressional_district text,
  country text not null default 'US',
  latitude numeric(10,6),
  longitude numeric(10,6),
  geocode_status text not null default 'unverified',
  service_radius_miles numeric(8,2),
  source_id text references data_sources(id),
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_locations_kind_check check (location_kind in (
    'primary',
    'practice',
    'mailing',
    'manufacturing',
    'warehouse',
    'retail',
    'service_delivery',
    'billing',
    'unknown'
  )),
  constraint entity_locations_geocode_status_check check (geocode_status in ('unverified', 'geocoded', 'manual_review', 'failed'))
);

create table if not exists entity_external_identifiers (
  id text primary key,
  entity_id text not null references national_healthcare_entities(id) on delete cascade,
  identifier_type text not null,
  identifier_value text not null,
  issuing_authority text,
  source_id text references data_sources(id),
  active boolean not null default true,
  valid_from date,
  valid_to date,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_external_identifiers_type_check check (identifier_type in (
    'npi',
    'ccn',
    'clia',
    'fda_fei',
    'fda_registration_number',
    'fda_owner_operator_number',
    'fda_labeler_code',
    'ndc_labeler_code',
    'gudid_labeler_duns',
    'hrsa_site_id',
    'sam_uei',
    'taxonomy_code',
    'state_license',
    'other'
  ))
);

create unique index if not exists entity_external_identifiers_active_key_idx
  on entity_external_identifiers(identifier_type, identifier_value, coalesce(issuing_authority, ''))
  where active;

create table if not exists entity_source_records (
  id text primary key,
  entity_id text references national_healthcare_entities(id) on delete set null,
  source_id text not null references data_sources(id),
  ingestion_run_id text references data_ingestion_runs(id),
  source_record_key text not null,
  source_url text,
  source_updated_at timestamptz,
  record_hash text,
  match_status text not null default 'unmatched',
  raw_record jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_source_records_match_status_check check (match_status in ('unmatched', 'matched', 'possible_duplicate', 'rejected', 'superseded')),
  constraint entity_source_records_source_key_unique unique (source_id, source_record_key)
);

create table if not exists entity_relationships (
  id text primary key,
  from_entity_id text not null references national_healthcare_entities(id) on delete cascade,
  to_entity_id text not null references national_healthcare_entities(id) on delete cascade,
  relationship_type text not null,
  confidence numeric(4,3) not null default 0.500,
  source_id text references data_sources(id),
  evidence_summary text,
  valid_from date,
  valid_to date,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_relationships_type_check check (relationship_type in (
    'owns',
    'operates',
    'affiliated_with',
    'manufactures_for',
    'distributes_for',
    'supplies',
    'parent_system',
    'subsidiary',
    'listed_importer',
    'known_importer',
    'same_as',
    'possible_match'
  )),
  constraint entity_relationships_confidence_check check (confidence >= 0 and confidence <= 1)
);

create table if not exists healthcare_facility_profiles (
  entity_id text primary key references national_healthcare_entities(id) on delete cascade,
  facility_category text not null,
  cms_facility_id text,
  hospital_type text,
  ownership text,
  emergency_services boolean,
  accepts_medicare boolean,
  overall_rating text,
  bed_count integer,
  specialty_tags text,
  services jsonb not null default '{}'::jsonb,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint healthcare_facility_profiles_category_check check (facility_category in (
    'hospital',
    'clinic',
    'pharmacy',
    'laboratory',
    'health_center',
    'provider_group',
    'other'
  ))
);

create table if not exists manufacturer_profiles (
  entity_id text primary key references national_healthcare_entities(id) on delete cascade,
  manufacturer_kind text not null,
  domestic_or_foreign text not null default 'unknown',
  fda_registration_status text not null default 'unknown',
  fda_registration_last_seen_at timestamptz,
  device_establishment boolean not null default false,
  drug_establishment boolean not null default false,
  operations text,
  fda_note text not null default 'FDA registration does not equal FDA approval, clearance, authorization, or certification.',
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manufacturer_profiles_kind_check check (manufacturer_kind in (
    'medical_device',
    'drug',
    'pharmaceutical',
    'biologic',
    'compounder',
    'outsourcing_facility',
    'distributor',
    'importer',
    'other'
  )),
  constraint manufacturer_profiles_domestic_check check (domestic_or_foreign in ('domestic', 'foreign', 'unknown')),
  constraint manufacturer_profiles_registration_check check (fda_registration_status in ('registered', 'inactive', 'expired', 'unknown', 'not_required'))
);

create table if not exists supplier_verification_profiles (
  entity_id text primary key references national_healthcare_entities(id) on delete cascade,
  supplier_status text not null default 'prospect',
  verified_supplier boolean not null default false,
  verification_level text not null default 'none',
  verified_by text,
  verified_at timestamptz,
  insurance_review boolean not null default false,
  seller_of_record_ready boolean not null default false,
  return_policy_review boolean not null default false,
  fulfillment_review boolean not null default false,
  compliance_review boolean not null default false,
  last_source_audit_at timestamptz,
  blockers jsonb not null default '[]'::jsonb,
  notes text,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_verification_profiles_status_check check (supplier_status in ('prospect', 'under_review', 'verified', 'approved_partner', 'blocked', 'retired')),
  constraint supplier_verification_profiles_level_check check (verification_level in ('none', 'source_seen', 'document_checked', 'contracted', 'live_feed_verified'))
);

create table if not exists regulatory_product_records (
  id text primary key,
  entity_id text references national_healthcare_entities(id) on delete set null,
  product_record_kind text not null,
  product_name text,
  brand_name text,
  model_number text,
  product_code text,
  device_class text,
  premarket_submission_number text,
  primary_di text,
  product_ndc text,
  package_ndc text,
  application_number text,
  marketing_category text,
  listing_status text not null default 'unknown',
  source_id text not null references data_sources(id),
  ingestion_run_id text references data_ingestion_runs(id),
  source_record_key text,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint regulatory_product_records_kind_check check (product_record_kind in ('fda_device_listing', 'gudid_device', 'ndc_drug', 'drug_establishment_product', 'other')),
  constraint regulatory_product_records_status_check check (listing_status in ('active', 'inactive', 'unknown'))
);

create table if not exists inventory_feeds (
  id text primary key,
  supplier_entity_id text not null references national_healthcare_entities(id) on delete cascade,
  feed_type text not null,
  connection_status text not null default 'planned',
  refresh_cadence text,
  sla_minutes integer,
  authenticated boolean not null default true,
  terms_status text not null default 'unreviewed',
  last_success_at timestamptz,
  last_failure_at timestamptz,
  raw_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_feeds_type_check check (feed_type in ('api', 'edi', 'csv', 'manual', 'shopify', 'email', 'portal')),
  constraint inventory_feeds_status_check check (connection_status in ('planned', 'requested', 'active', 'paused', 'failed', 'retired')),
  constraint inventory_feeds_terms_status_check check (terms_status in ('unreviewed', 'approved', 'rejected', 'expired'))
);

create table if not exists inventory_snapshots (
  id text primary key,
  feed_id text references inventory_feeds(id) on delete set null,
  supplier_entity_id text not null references national_healthcare_entities(id) on delete cascade,
  product_candidate_id text references product_candidates(id) on delete set null,
  regulatory_product_record_id text references regulatory_product_records(id) on delete set null,
  location_id text references entity_locations(id) on delete set null,
  supplier_sku text,
  gtin text,
  ndc text,
  udi text,
  postal_code text,
  quantity_on_hand integer,
  availability text not null default 'unknown',
  unit_price numeric(12,2),
  currency text not null default 'USD',
  lead_time_days integer,
  moq integer,
  captured_at timestamptz not null,
  expires_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint inventory_snapshots_availability_check check (availability in ('in_stock', 'limited', 'out_of_stock', 'backorder', 'unknown'))
);

create table if not exists localized_b2b_matches (
  id text primary key,
  buyer_entity_id text references national_healthcare_entities(id) on delete set null,
  supplier_entity_id text not null references national_healthcare_entities(id) on delete cascade,
  product_candidate_id text references product_candidates(id) on delete set null,
  match_status text not null default 'candidate',
  buyer_postal_code text,
  supplier_postal_code text,
  distance_miles numeric(8,2),
  locality_score numeric(5,2) not null default 0,
  inventory_score numeric(5,2) not null default 0,
  compliance_score numeric(5,2) not null default 0,
  doctor_fit_score numeric(5,2) not null default 0,
  total_score numeric(5,2) not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint localized_b2b_matches_status_check check (match_status in ('candidate', 'qualified', 'blocked', 'won', 'lost', 'expired'))
);

create table if not exists clinical_fit_reviews (
  id text primary key,
  product_candidate_id text not null references product_candidates(id) on delete cascade,
  review_scope text not null,
  reviewer_role text not null,
  reviewer_name text,
  specialty text,
  taxonomy_code text,
  target_facility_kind text,
  recommendation text not null,
  rationale text,
  evidence_links text,
  reviewed_at timestamptz not null,
  expires_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_fit_reviews_scope_check check (review_scope in ('doctor_fit', 'pharmacist_fit', 'specialty_fit', 'facility_fit')),
  constraint clinical_fit_reviews_reviewer_role_check check (reviewer_role in ('clinician', 'pharmacist', 'medical_advisor', 'compliance', 'operations')),
  constraint clinical_fit_reviews_recommendation_check check (recommendation in ('recommended', 'neutral', 'not_recommended', 'requires_review'))
);

create table if not exists data_quality_findings (
  id text primary key,
  source_id text references data_sources(id),
  ingestion_run_id text references data_ingestion_runs(id),
  entity_id text references national_healthcare_entities(id) on delete set null,
  severity text not null default 'medium',
  finding_type text not null,
  status text not null default 'open',
  message text not null,
  evidence jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_quality_findings_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint data_quality_findings_type_check check (finding_type in ('duplicate', 'stale_source', 'missing_identifier', 'address_conflict', 'name_conflict', 'license_conflict', 'unverified_claim', 'privacy_risk', 'other')),
  constraint data_quality_findings_status_check check (status in ('open', 'triaged', 'resolved', 'ignored'))
);

create table if not exists supplier_lead_research_runs (
  id text primary key,
  run_name text not null,
  market_scene text not null default 'Boston-Cambridge medical device corridor',
  geography_priority text not null default 'boston_first',
  target_regions jsonb not null default '[]'::jsonb,
  target_product_taxonomy jsonb not null default '[]'::jsonb,
  search_queries jsonb not null default '[]'::jsonb,
  source_summary jsonb not null default '{}'::jsonb,
  run_status text not null default 'queued',
  rows_found integer not null default 0,
  rows_added integer not null default 0,
  rows_rejected integer not null default 0,
  reviewer text,
  started_at timestamptz,
  completed_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_lead_runs_geography_check check (geography_priority in (
    'boston_first',
    'east_coast',
    'west_coast',
    'midwest_south',
    'national_backfill'
  )),
  constraint supplier_lead_runs_status_check check (run_status in ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled'))
);

create table if not exists supplier_lead_records (
  id text primary key,
  research_run_id text references supplier_lead_research_runs(id) on delete set null,
  entity_id text references national_healthcare_entities(id) on delete set null,
  legal_name text not null,
  display_name text,
  website_url text,
  hq_address_line1 text,
  hq_city text,
  hq_state text,
  hq_postal_code text,
  metro_area text not null default 'Boston-Cambridge-Newton, MA-NH',
  region_priority text not null default 'boston_first',
  company_type text not null default 'medical_device_manufacturer',
  product_categories jsonb not null default '[]'::jsonb,
  product_fit_notes text,
  current_distribution_model text,
  aidlyst_model_fit text not null default 'medium',
  revenue_fit_score numeric(5,2) not null default 0,
  compliance_risk_level text not null default 'unknown',
  outreach_status text not null default 'research_ready',
  review_status text not null default 'needs_review',
  dedupe_key text not null,
  public_phone_numbers jsonb not null default '[]'::jsonb,
  public_contact_routes jsonb not null default '[]'::jsonb,
  public_contact_evidence jsonb not null default '[]'::jsonb,
  regulatory_evidence jsonb not null default '[]'::jsonb,
  recall_evidence jsonb not null default '[]'::jsonb,
  local_market_evidence jsonb not null default '[]'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  notes text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_lead_records_region_check check (region_priority in (
    'boston_first',
    'east_coast',
    'west_coast',
    'midwest_south',
    'national_backfill'
  )),
  constraint supplier_lead_records_type_check check (company_type in (
    'medical_device_manufacturer',
    'medtech_company',
    'dme_manufacturer',
    'wound_care_manufacturer',
    'compression_manufacturer',
    'rehab_manufacturer',
    'clinical_supply_manufacturer',
    'distributor',
    'other'
  )),
  constraint supplier_lead_records_fit_check check (aidlyst_model_fit in ('high', 'medium', 'low', 'exclude')),
  constraint supplier_lead_records_risk_check check (compliance_risk_level in ('low', 'medium', 'high', 'prohibited', 'unknown')),
  constraint supplier_lead_records_outreach_check check (outreach_status in (
    'research_ready',
    'outreach_drafted',
    'approved_to_contact',
    'contacted',
    'meeting_requested',
    'meeting_scheduled',
    'not_interested',
    'blocked',
    'do_not_contact'
  )),
  constraint supplier_lead_records_review_check check (review_status in ('needs_review', 'approved', 'rejected', 'blocked'))
);

create table if not exists supplier_contact_points (
  id text primary key,
  lead_record_id text not null references supplier_lead_records(id) on delete cascade,
  contact_kind text not null,
  label text,
  value text not null,
  source_url text,
  is_public_source boolean not null default true,
  personal_data_level text not null default 'public_business',
  verification_status text not null default 'unverified',
  last_checked_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_contact_points_kind_check check (contact_kind in (
    'phone',
    'email',
    'contact_form',
    'linkedin_company',
    'address',
    'other'
  )),
  constraint supplier_contact_points_personal_data_check check (personal_data_level in (
    'public_business',
    'public_professional',
    'restricted_business',
    'contains_personal_data'
  )),
  constraint supplier_contact_points_verification_check check (verification_status in ('unverified', 'source_seen', 'cross_checked', 'invalid', 'do_not_use'))
);

create table if not exists supplier_deals (
  id text primary key,
  lead_record_id text not null references supplier_lead_records(id) on delete cascade,
  entity_id text references national_healthcare_entities(id) on delete set null,
  deal_name text not null,
  stage text not null default 'research_ready',
  proposed_model text not null default 'Manufacturer-direct marketplace listing: Aidlyst does not buy inventory; the manufacturer or approved medtech partner keeps the majority of product revenue and Aidlyst takes a small transaction percentage on completed sales.',
  proposed_first_product_set jsonb not null default '[]'::jsonb,
  local_market_wedge text,
  deal_thesis jsonb not null default '[]'::jsonb,
  transaction_fee_note text not null default 'TBD after margin, fulfillment, return, compliance, and payment-flow review.',
  required_diligence jsonb not null default '[]'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  meeting_objective text,
  recommended_next_action text,
  risk_summary text,
  source_urls jsonb not null default '[]'::jsonb,
  owner text,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_deals_stage_check check (stage in (
    'research_ready',
    'outreach_drafted',
    'contacted',
    'meeting_requested',
    'meeting_scheduled',
    'negotiating',
    'compliance_review',
    'approved_supplier',
    'rejected',
    'blocked'
  ))
);

create table if not exists supplier_outreach_drafts (
  id text primary key,
  deal_id text not null references supplier_deals(id) on delete cascade,
  draft_kind text not null,
  subject text,
  body text not null,
  follow_up_one text,
  follow_up_two text,
  source_context jsonb not null default '{}'::jsonb,
  approval_status text not null default 'needs_review',
  approved_by text,
  approved_at timestamptz,
  sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_outreach_drafts_kind_check check (draft_kind in (
    'email',
    'phone_script',
    'voicemail',
    'linkedin',
    'contact_form',
    'meeting_questions'
  )),
  constraint supplier_outreach_drafts_approval_check check (approval_status in ('needs_review', 'approved', 'rejected', 'sent', 'retired'))
);

create table if not exists supplier_meeting_packets (
  id text primary key,
  deal_id text not null references supplier_deals(id) on delete cascade,
  packet_date date not null default current_date,
  company_summary text,
  product_fit_summary text,
  local_market_summary text,
  call_agenda jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  red_flags jsonb not null default '[]'::jsonb,
  diligence_checklist jsonb not null default '[]'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists supplier_people (
  id text primary key,
  lead_record_id text references supplier_lead_records(id) on delete cascade,
  entity_id text references national_healthcare_entities(id) on delete set null,
  full_name text,
  role_title text,
  department text,
  authority_level text not null default 'unknown',
  public_profile_url text,
  public_contact_point_id text references supplier_contact_points(id) on delete set null,
  relationship_status text not null default 'unknown',
  contact_preference text,
  business_context_notes text,
  source_urls jsonb not null default '[]'::jsonb,
  personal_data_level text not null default 'public_business',
  do_not_contact boolean not null default false,
  last_checked_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_people_authority_check check (authority_level in (
    'unknown',
    'influencer',
    'technical_buyer',
    'economic_buyer',
    'decision_maker',
    'legal_compliance',
    'operations_fulfillment',
    'finance'
  )),
  constraint supplier_people_relationship_status_check check (relationship_status in (
    'unknown',
    'cold',
    'warm',
    'active_thread',
    'meeting_scheduled',
    'champion',
    'blocked',
    'do_not_contact'
  )),
  constraint supplier_people_personal_data_check check (personal_data_level in (
    'public_business',
    'public_professional',
    'restricted_business',
    'contains_personal_data'
  ))
);

create table if not exists supplier_relationship_events (
  id text primary key,
  lead_record_id text references supplier_lead_records(id) on delete cascade,
  deal_id text references supplier_deals(id) on delete cascade,
  supplier_person_id text references supplier_people(id) on delete set null,
  event_type text not null,
  event_at timestamptz not null default now(),
  channel text,
  summary text not null,
  objections jsonb not null default '[]'::jsonb,
  next_step text,
  next_step_due_at timestamptz,
  source_urls jsonb not null default '[]'::jsonb,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_relationship_events_type_check check (event_type in (
    'research_note',
    'email_drafted',
    'email_sent',
    'call_attempt',
    'call_completed',
    'voicemail',
    'meeting',
    'objection',
    'document_requested',
    'document_received',
    'terms_review',
    'follow_up',
    'blocked'
  )),
  constraint supplier_relationship_events_channel_check check (channel is null or channel in (
    'email',
    'phone',
    'voicemail',
    'linkedin',
    'contact_form',
    'meeting',
    'internal_note',
    'other'
  ))
);

create table if not exists supplier_source_evidence (
  id text primary key,
  lead_record_id text references supplier_lead_records(id) on delete cascade,
  entity_id text references national_healthcare_entities(id) on delete set null,
  evidence_type text not null,
  source_url text,
  source_title text,
  summary text not null,
  confidence text not null default 'medium',
  last_checked_at timestamptz,
  content_hash text,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_source_evidence_type_check check (evidence_type in (
    'company_site',
    'contact_page',
    'product_catalog',
    'fda_registration',
    'fda_listing',
    'gudid',
    '510k',
    'recall',
    'cms',
    'press_release',
    'trade_directory',
    'manual_review',
    'other'
  )),
  constraint supplier_source_evidence_confidence_check check (confidence in ('low', 'medium', 'high'))
);

create table if not exists supplier_score_snapshots (
  id text primary key,
  lead_record_id text not null references supplier_lead_records(id) on delete cascade,
  scoring_version text not null,
  aidlyst_model_fit text not null,
  revenue_fit_score numeric(5,2) not null default 0,
  compliance_score numeric(5,2) not null default 0,
  fulfillment_score numeric(5,2) not null default 0,
  relationship_score numeric(5,2) not null default 0,
  total_score numeric(5,2) not null default 0,
  score_inputs jsonb not null default '{}'::jsonb,
  reviewer text,
  created_at timestamptz not null default now(),
  constraint supplier_score_snapshots_fit_check check (aidlyst_model_fit in ('high', 'medium', 'low', 'exclude'))
);

create table if not exists supplier_contract_terms (
  id text primary key,
  deal_id text references supplier_deals(id) on delete cascade,
  lead_record_id text references supplier_lead_records(id) on delete cascade,
  entity_id text references national_healthcare_entities(id) on delete set null,
  terms_status text not null default 'unreviewed',
  transaction_fee_type text,
  transaction_fee_rate numeric(8,4),
  transaction_fee_note text,
  payout_terms_summary text,
  map_policy_summary text,
  channel_conflict_notes text,
  return_policy_summary text,
  warranty_summary text,
  data_sharing_terms_summary text,
  reviewed_by text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_contract_terms_status_check check (terms_status in (
    'unreviewed',
    'requested',
    'under_review',
    'approved',
    'rejected',
    'expired'
  )),
  constraint supplier_contract_terms_fee_type_check check (transaction_fee_type is null or transaction_fee_type in (
    'percentage',
    'flat',
    'hybrid',
    'tbd'
  ))
);

create table if not exists supplier_compliance_documents (
  id text primary key,
  deal_id text references supplier_deals(id) on delete cascade,
  lead_record_id text references supplier_lead_records(id) on delete cascade,
  entity_id text references national_healthcare_entities(id) on delete set null,
  document_type text not null,
  document_status text not null default 'missing',
  storage_reference text,
  source_url text,
  summary text,
  reviewed_by text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_compliance_documents_type_check check (document_type in (
    'w9',
    'ach_payment',
    'insurance_coi',
    'product_catalog',
    'labeling',
    'image_permission',
    'fda_or_regulatory',
    'return_policy',
    'warranty_policy',
    'recall_process',
    'adverse_event_process',
    'quality_system',
    'contract',
    'other'
  )),
  constraint supplier_compliance_documents_status_check check (document_status in (
    'missing',
    'requested',
    'received',
    'under_review',
    'approved',
    'rejected',
    'expired'
  ))
);

create table if not exists supplier_export_logs (
  id text primary key,
  export_type text not null,
  requested_by text,
  purpose text not null,
  included_tables jsonb not null default '[]'::jsonb,
  row_count integer not null default 0,
  redaction_level text not null default 'internal',
  destination text,
  created_at timestamptz not null default now(),
  raw_record jsonb not null default '{}'::jsonb,
  constraint supplier_export_logs_type_check check (export_type in (
    'supplier_leads',
    'deal_pipeline',
    'meeting_packet',
    'outreach_drafts',
    'compliance_documents',
    'score_snapshot',
    'other'
  )),
  constraint supplier_export_logs_redaction_check check (redaction_level in (
    'internal',
    'redacted',
    'aggregate',
    'nda_required'
  ))
);

create table if not exists customer_consent_events (
  id text primary key,
  customer_subject_id text,
  session_id text,
  consent_scope text not null,
  consent_status text not null,
  collection_purpose text not null,
  source_surface text,
  policy_version text,
  consented_at timestamptz not null default now(),
  expires_at timestamptz,
  withdrawn_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint customer_consent_events_scope_check check (consent_scope in (
    'product_personalization',
    'search_history',
    'saved_preferences',
    'email_updates',
    'supplier_quote_sharing',
    'analytics',
    'profile_storage'
  )),
  constraint customer_consent_events_status_check check (consent_status in ('granted', 'withdrawn', 'expired', 'denied'))
);

create table if not exists customer_sessions (
  id text primary key,
  customer_subject_id text,
  session_kind text not null default 'guest',
  consent_state text not null default 'none',
  data_classification text not null default 'anonymous',
  started_at timestamptz not null default now(),
  last_seen_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  deleted_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_sessions_kind_check check (session_kind in ('guest', 'authenticated', 'rfq', 'support')),
  constraint customer_sessions_consent_check check (consent_state in ('none', 'session_only', 'opt_in', 'withdrawn')),
  constraint customer_sessions_classification_check check (data_classification in (
    'anonymous',
    'pseudonymous',
    'consumer_health_data_possible',
    'prohibited_phi'
  ))
);

create table if not exists customer_preference_cache (
  id text primary key,
  session_id text references customer_sessions(id) on delete cascade,
  customer_subject_id text,
  cache_kind text not null default 'search_preferences',
  preference_tags jsonb not null default '{}'::jsonb,
  source_summary jsonb not null default '{}'::jsonb,
  contains_raw_health_text boolean not null default false,
  redaction_status text not null default 'not_required',
  expires_at timestamptz not null default (now() + interval '7 days'),
  deleted_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_preference_cache_kind_check check (cache_kind in (
    'search_preferences',
    'recommendation_context',
    'comparison_state',
    'fit_tags',
    'rfq_context'
  )),
  constraint customer_preference_cache_redaction_check check (redaction_status in (
    'not_required',
    'redacted',
    'transformed_to_tags',
    'blocked',
    'manual_review'
  )),
  constraint customer_preference_cache_no_raw_health_text check (contains_raw_health_text = false)
);

create table if not exists customer_saved_preferences (
  id text primary key,
  customer_subject_id text not null,
  consent_event_id text references customer_consent_events(id) on delete restrict,
  profile_label text,
  preference_tags jsonb not null default '{}'::jsonb,
  personalization_enabled boolean not null default false,
  data_minimization_notes text,
  last_compiled_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_recommendation_events (
  id text primary key,
  session_id text references customer_sessions(id) on delete set null,
  customer_subject_id text,
  source_cache_id text references customer_preference_cache(id) on delete set null,
  product_candidate_id text references product_candidates(id) on delete set null,
  recommendation_basis jsonb not null default '{}'::jsonb,
  shown_at timestamptz not null default now(),
  clicked_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists privacy_redaction_events (
  id text primary key,
  session_id text references customer_sessions(id) on delete set null,
  customer_subject_id text,
  source_surface text not null,
  detected_data_types jsonb not null default '[]'::jsonb,
  action text not null,
  raw_content_stored boolean not null default false,
  redacted_summary text,
  reviewer text,
  created_at timestamptz not null default now(),
  raw_record jsonb not null default '{}'::jsonb,
  constraint privacy_redaction_events_action_check check (action in (
    'blocked',
    'redacted',
    'transformed_to_tags',
    'deleted',
    'manual_review'
  )),
  constraint privacy_redaction_events_no_raw_content check (raw_content_stored = false)
);

create table if not exists customer_data_deletion_requests (
  id text primary key,
  customer_subject_id text not null,
  request_type text not null,
  request_status text not null default 'received',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  scope_summary text,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_data_deletion_requests_type_check check (request_type in (
    'clear_session',
    'delete_saved_preferences',
    'delete_account',
    'withdraw_consent',
    'export_preferences'
  )),
  constraint customer_data_deletion_requests_status_check check (request_status in (
    'received',
    'in_progress',
    'completed',
    'rejected',
    'cancelled'
  ))
);

create table if not exists customer_profile_compilations (
  id text primary key,
  customer_subject_id text not null,
  consent_event_id text references customer_consent_events(id) on delete restrict,
  source_cache_ids jsonb not null default '[]'::jsonb,
  compiled_preference_tags jsonb not null default '{}'::jsonb,
  excluded_fields jsonb not null default '[]'::jsonb,
  compilation_status text not null default 'compiled',
  compiled_at timestamptz not null default now(),
  expires_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint customer_profile_compilations_status_check check (compilation_status in (
    'compiled',
    'partial',
    'blocked',
    'deleted'
  ))
);

create index if not exists data_ingestion_runs_source_status_idx on data_ingestion_runs(source_id, status, started_at desc);
create index if not exists national_entities_kind_status_idx on national_healthcare_entities(entity_kind, lifecycle_status, verification_status);
create index if not exists national_entities_normalized_name_idx on national_healthcare_entities(normalized_name);
create index if not exists entity_locations_entity_kind_idx on entity_locations(entity_id, location_kind);
create index if not exists entity_locations_postal_idx on entity_locations(state, postal_code);
create index if not exists entity_locations_lat_lon_idx on entity_locations(latitude, longitude);
create index if not exists entity_source_records_entity_source_idx on entity_source_records(entity_id, source_id);
create index if not exists entity_relationships_from_type_idx on entity_relationships(from_entity_id, relationship_type);
create index if not exists entity_relationships_to_type_idx on entity_relationships(to_entity_id, relationship_type);
create index if not exists regulatory_product_records_entity_kind_idx on regulatory_product_records(entity_id, product_record_kind);
create index if not exists regulatory_product_records_product_code_idx on regulatory_product_records(product_code);
create index if not exists regulatory_product_records_ndc_idx on regulatory_product_records(product_ndc, package_ndc);
create index if not exists regulatory_product_records_primary_di_idx on regulatory_product_records(primary_di);
create index if not exists inventory_feeds_supplier_status_idx on inventory_feeds(supplier_entity_id, connection_status);
create index if not exists inventory_snapshots_supplier_captured_idx on inventory_snapshots(supplier_entity_id, captured_at desc);
create index if not exists inventory_snapshots_product_captured_idx on inventory_snapshots(product_candidate_id, captured_at desc);
create index if not exists inventory_snapshots_regulatory_product_idx on inventory_snapshots(regulatory_product_record_id, captured_at desc);
create index if not exists localized_b2b_matches_supplier_status_idx on localized_b2b_matches(supplier_entity_id, match_status, total_score desc);
create index if not exists localized_b2b_matches_buyer_status_idx on localized_b2b_matches(buyer_entity_id, match_status, total_score desc);
create index if not exists clinical_fit_reviews_product_scope_idx on clinical_fit_reviews(product_candidate_id, review_scope, reviewed_at desc);
create index if not exists data_quality_findings_source_status_idx on data_quality_findings(source_id, status, severity);
create index if not exists supplier_lead_runs_status_idx on supplier_lead_research_runs(run_status, created_at desc);
create unique index if not exists supplier_lead_records_dedupe_idx on supplier_lead_records(dedupe_key);
create index if not exists supplier_lead_records_region_fit_idx on supplier_lead_records(region_priority, aidlyst_model_fit, compliance_risk_level);
create index if not exists supplier_lead_records_metro_idx on supplier_lead_records(metro_area, hq_state, hq_postal_code);
create index if not exists supplier_contact_points_lead_kind_idx on supplier_contact_points(lead_record_id, contact_kind);
create index if not exists supplier_deals_lead_stage_idx on supplier_deals(lead_record_id, stage);
create index if not exists supplier_outreach_drafts_deal_status_idx on supplier_outreach_drafts(deal_id, approval_status);
create index if not exists supplier_meeting_packets_deal_date_idx on supplier_meeting_packets(deal_id, packet_date desc);
create index if not exists supplier_people_lead_status_idx on supplier_people(lead_record_id, relationship_status);
create index if not exists supplier_people_entity_authority_idx on supplier_people(entity_id, authority_level);
create index if not exists supplier_relationship_events_lead_time_idx on supplier_relationship_events(lead_record_id, event_at desc);
create index if not exists supplier_relationship_events_deal_time_idx on supplier_relationship_events(deal_id, event_at desc);
create index if not exists supplier_source_evidence_lead_type_idx on supplier_source_evidence(lead_record_id, evidence_type);
create index if not exists supplier_score_snapshots_lead_created_idx on supplier_score_snapshots(lead_record_id, created_at desc);
create index if not exists supplier_contract_terms_deal_status_idx on supplier_contract_terms(deal_id, terms_status);
create index if not exists supplier_compliance_documents_lead_status_idx on supplier_compliance_documents(lead_record_id, document_status);
create index if not exists supplier_export_logs_created_idx on supplier_export_logs(created_at desc);
create index if not exists customer_consent_events_subject_scope_idx on customer_consent_events(customer_subject_id, consent_scope, consented_at desc);
create index if not exists customer_sessions_subject_expiry_idx on customer_sessions(customer_subject_id, expires_at);
create index if not exists customer_preference_cache_session_expiry_idx on customer_preference_cache(session_id, expires_at);
create index if not exists customer_saved_preferences_subject_idx on customer_saved_preferences(customer_subject_id, personalization_enabled);
create index if not exists customer_recommendation_events_session_shown_idx on customer_recommendation_events(session_id, shown_at desc);
create index if not exists privacy_redaction_events_session_created_idx on privacy_redaction_events(session_id, created_at desc);
create index if not exists customer_data_deletion_requests_subject_status_idx on customer_data_deletion_requests(customer_subject_id, request_status);
create index if not exists customer_profile_compilations_subject_compiled_idx on customer_profile_compilations(customer_subject_id, compiled_at desc);

-- Supabase safety boundary: these tables are intended for server-side use.
-- RLS keeps browser/Data API access closed unless explicit policies are added.
alter table policy_versions enable row level security;
alter table product_candidates enable row level security;
alter table suppliers enable row level security;
alter table supplier_offers enable row level security;
alter table shopify_push_queue enable row level security;
alter table direct_sales_readiness enable row level security;
alter table commerce_decisions enable row level security;
alter table audit_events enable row level security;
alter table evidence_items enable row level security;
alter table idempotency_keys enable row level security;
alter table shopify_draft_plans enable row level security;
alter table data_sources enable row level security;
alter table data_ingestion_runs enable row level security;
alter table national_healthcare_entities enable row level security;
alter table entity_locations enable row level security;
alter table entity_external_identifiers enable row level security;
alter table entity_source_records enable row level security;
alter table entity_relationships enable row level security;
alter table healthcare_facility_profiles enable row level security;
alter table manufacturer_profiles enable row level security;
alter table supplier_verification_profiles enable row level security;
alter table regulatory_product_records enable row level security;
alter table inventory_feeds enable row level security;
alter table inventory_snapshots enable row level security;
alter table localized_b2b_matches enable row level security;
alter table clinical_fit_reviews enable row level security;
alter table data_quality_findings enable row level security;
alter table supplier_lead_research_runs enable row level security;
alter table supplier_lead_records enable row level security;
alter table supplier_contact_points enable row level security;
alter table supplier_deals enable row level security;
alter table supplier_outreach_drafts enable row level security;
alter table supplier_meeting_packets enable row level security;
alter table supplier_people enable row level security;
alter table supplier_relationship_events enable row level security;
alter table supplier_source_evidence enable row level security;
alter table supplier_score_snapshots enable row level security;
alter table supplier_contract_terms enable row level security;
alter table supplier_compliance_documents enable row level security;
alter table supplier_export_logs enable row level security;
alter table customer_consent_events enable row level security;
alter table customer_sessions enable row level security;
alter table customer_preference_cache enable row level security;
alter table customer_saved_preferences enable row level security;
alter table customer_recommendation_events enable row level security;
alter table privacy_redaction_events enable row level security;
alter table customer_data_deletion_requests enable row level security;
alter table customer_profile_compilations enable row level security;

grant select, insert, update, delete on
  policy_versions,
  product_candidates,
  suppliers,
  supplier_offers,
  shopify_push_queue,
  direct_sales_readiness,
  commerce_decisions,
  audit_events,
  evidence_items,
  idempotency_keys,
  shopify_draft_plans,
  data_sources,
  data_ingestion_runs,
  national_healthcare_entities,
  entity_locations,
  entity_external_identifiers,
  entity_source_records,
  entity_relationships,
  healthcare_facility_profiles,
  manufacturer_profiles,
  supplier_verification_profiles,
  regulatory_product_records,
  inventory_feeds,
  inventory_snapshots,
  localized_b2b_matches,
  clinical_fit_reviews,
  data_quality_findings,
  supplier_lead_research_runs,
  supplier_lead_records,
  supplier_contact_points,
  supplier_deals,
  supplier_outreach_drafts,
  supplier_meeting_packets,
  supplier_people,
  supplier_relationship_events,
  supplier_source_evidence,
  supplier_score_snapshots,
  supplier_contract_terms,
  supplier_compliance_documents,
  supplier_export_logs,
  customer_consent_events,
  customer_sessions,
  customer_preference_cache,
  customer_saved_preferences,
  customer_recommendation_events,
  privacy_redaction_events,
  customer_data_deletion_requests,
  customer_profile_compilations
to service_role;

grant usage, select on all sequences in schema public to service_role;
