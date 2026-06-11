const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');

function schema() {
  return fs.readFileSync(schemaPath, 'utf8');
}

test('schema includes the national healthcare database foundation', () => {
  const sql = schema();
  const requiredTables = [
    'data_sources',
    'data_ingestion_runs',
    'national_healthcare_entities',
    'entity_locations',
    'entity_external_identifiers',
    'entity_source_records',
    'entity_relationships',
    'healthcare_facility_profiles',
    'manufacturer_profiles',
    'supplier_verification_profiles',
    'regulatory_product_records',
    'inventory_feeds',
    'inventory_snapshots',
    'localized_b2b_matches',
    'clinical_fit_reviews',
    'data_quality_findings'
  ];

  for (const table of requiredTables) {
    assert.match(sql, new RegExp(`create table if not exists ${table}\\b`));
    assert.match(sql, new RegExp(`alter table ${table} enable row level security;`));
  }
});

test('schema seeds official source coverage and keeps public access closed by default', () => {
  const sql = schema();
  const sourceIds = [
    'cms_nppes_npi_files',
    'cms_hospital_general_information',
    'hrsa_health_center_service_sites',
    'cms_clia_clinical_laboratories',
    'fda_device_registration_listing',
    'fda_drug_establishments_decrs',
    'accessgudid',
    'openfda_ndc_directory'
  ];

  for (const sourceId of sourceIds) {
    assert.match(sql, new RegExp(`'${sourceId}'`));
  }

  assert.match(sql, /FDA registration does not equal FDA approval, clearance, authorization, or certification\./);
  assert.match(sql, /to service_role;/);
  assert.doesNotMatch(sql, /\bto anon\b/i);
  assert.doesNotMatch(sql, /\bto authenticated\b/i);
});

test('schema separates durable supplier intelligence from consent-bound customer preferences', () => {
  const sql = schema();
  const supplierTables = [
    'supplier_lead_research_runs',
    'supplier_lead_records',
    'supplier_contact_points',
    'supplier_deals',
    'supplier_outreach_drafts',
    'supplier_meeting_packets',
    'supplier_people',
    'supplier_relationship_events',
    'supplier_source_evidence',
    'supplier_score_snapshots',
    'supplier_contract_terms',
    'supplier_compliance_documents',
    'supplier_export_logs'
  ];
  const customerPrivacyTables = [
    'customer_consent_events',
    'customer_sessions',
    'customer_preference_cache',
    'customer_saved_preferences',
    'customer_recommendation_events',
    'privacy_redaction_events',
    'customer_data_deletion_requests',
    'customer_profile_compilations'
  ];

  for (const table of [...supplierTables, ...customerPrivacyTables]) {
    assert.match(sql, new RegExp(`create table if not exists ${table}\\b`));
    assert.match(sql, new RegExp(`alter table ${table} enable row level security;`));
  }

  assert.match(sql, /constraint customer_preference_cache_no_raw_health_text check \(contains_raw_health_text = false\)/);
  assert.match(sql, /constraint privacy_redaction_events_no_raw_content check \(raw_content_stored = false\)/);
  assert.match(sql, /'supplier_quote_sharing'/);
  assert.match(sql, /'delete_saved_preferences'/);
  assert.match(sql, /supplier_export_logs/);
});
