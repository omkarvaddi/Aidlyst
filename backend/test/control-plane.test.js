const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { FileAuditStore } = require('../src/audit-store');
const { FileCatalogStore } = require('../src/catalog-store');
const { ControlPlane } = require('../src/control-plane');

const NOW = new Date('2026-06-03T12:00:00.000Z');

function csvLine(values) {
  return values.map((value) => {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',');
}

function writeDataset(vaultPath, name, header, rows) {
  const dataDir = path.join(vaultPath, '12 Business Datasets', 'CSV');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, `${name}.csv`),
    `${csvLine(header)}\n${rows.map((row) => csvLine(header.map((field) => row[field] || ''))).join('\n')}\n`,
    'utf8'
  );
}

function createVault() {
  const vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aidlyst-vault-'));

  writeDataset(vaultPath, 'product_sourcing_pipeline', [
    'id', 'name', 'requested_by', 'request_source', 'category', 'subcategory', 'product_type', 'otc_status',
    'regulatory_path', 'fda_device_class', 'fda_product_code', 'rx_or_restricted_flag', 'intended_use_source',
    'claim_risk', 'pharmacist_recommended_status', 'pharmacist_reviewer', 'medical_advisor_required',
    'medical_advisor_status', 'commerce_mode_recommendation', 'evidence_summary', 'source_links', 'status',
    'owner', 'source', 'confidence', 'last_updated', 'next_action'
  ], [{
    id: 'PSC-TEST-001',
    name: 'First Aid Kit',
    requested_by: 'test',
    request_source: 'unit test',
    category: 'First Aid',
    product_type: 'first_aid_kit',
    otc_status: 'otc_health_supply',
    regulatory_path: 'verify_product_labeling',
    fda_device_class: 'not_required',
    fda_product_code: 'not_required',
    rx_or_restricted_flag: 'no',
    intended_use_source: 'manufacturer_labeling_reviewed',
    claim_risk: 'low',
    pharmacist_recommended_status: 'approved',
    pharmacist_reviewer: 'Approved review source',
    medical_advisor_required: 'yes',
    medical_advisor_status: 'approved',
    commerce_mode_recommendation: 'affiliate',
    evidence_summary: 'Compare contents, price, shipping, and return policy.',
    source_links: 'https://manufacturer.example/first-aid',
    status: 'candidate',
    owner: 'Product',
    source: 'unit test',
    confidence: 'high',
    last_updated: '2026-06-03',
    next_action: 'push draft'
  }]);

  writeDataset(vaultPath, 'supplier_vendor_dataset', [
    'id', 'name', 'type', 'category_focus', 'monetization_fit', 'risk_level', 'owner', 'status', 'source',
    'confidence', 'last_updated', 'next_action'
  ], [{
    id: 'VEN-TEST-AFF',
    name: 'Approved Affiliate Retailer',
    type: 'affiliate marketplace',
    category_focus: 'first aid',
    monetization_fit: 'high',
    risk_level: 'low',
    owner: 'Growth',
    status: 'active',
    source: 'unit test',
    confidence: 'high',
    last_updated: '2026-06-03',
    next_action: 'use'
  }]);

  writeDataset(vaultPath, 'supplier_offer_rates', [
    'id', 'name', 'product_candidate_id', 'supplier_id', 'supplier_sku', 'gtin', 'offer_url', 'affiliate_url',
    'currency', 'item_price', 'shipping_estimate', 'total_landed_cost', 'commission_rate', 'commission_type',
    'availability', 'moq', 'lead_time', 'return_policy_summary', 'rate_source', 'source_url', 'last_checked',
    'winner_status', 'owner', 'source', 'confidence', 'last_updated', 'next_action'
  ], [{
    id: 'OFF-TEST-001',
    name: 'First Aid Kit affiliate offer',
    product_candidate_id: 'PSC-TEST-001',
    supplier_id: 'VEN-TEST-AFF',
    supplier_sku: 'FIRST-AID-001',
    offer_url: 'https://retailer.example/first-aid',
    affiliate_url: 'https://retailer.example/first-aid?tag=aidlyst-20',
    currency: 'USD',
    item_price: '18.00',
    total_landed_cost: '18.00',
    availability: 'available',
    lead_time: '3',
    return_policy_summary: 'Retailer return policy applies',
    rate_source: 'unit test',
    source_url: 'https://retailer.example/first-aid',
    last_checked: '2026-06-03T10:00:00.000Z',
    winner_status: 'selected_candidate',
    owner: 'Operations',
    source: 'unit test',
    confidence: 'high',
    last_updated: '2026-06-03',
    next_action: 'use'
  }]);

  writeDataset(vaultPath, 'shopify_product_push_queue', [
    'id', 'name', 'product_candidate_id', 'shopify_handle', 'shopify_product_id', 'primary_offer_id',
    'commerce_mode', 'shopify_status', 'selected_price', 'selected_affiliate_url', 'required_metafields',
    'copy_status', 'image_permission_status', 'pharmacist_gate_status', 'medical_advisor_gate_status',
    'compliance_gate_status', 'ready_to_push', 'pushed_at', 'last_error', 'owner', 'source', 'confidence',
    'last_updated', 'next_action'
  ], [{
    id: 'PUSH-TEST-001',
    name: 'First Aid Kit draft',
    product_candidate_id: 'PSC-TEST-001',
    shopify_handle: 'first-aid-kit',
    primary_offer_id: 'OFF-TEST-001',
    commerce_mode: 'affiliate',
    shopify_status: 'draft',
    selected_price: '18.00',
    selected_affiliate_url: 'https://retailer.example/first-aid?tag=aidlyst-20',
    required_metafields: 'custom.affiliate_url;custom.commerce_mode;custom.risk_level;custom.last_checked;custom.seller_of_record;custom.fda_note;custom.claim_notes;custom.medical_advisor_status;custom.pharmacist_recommendation_status;custom.source_notes',
    copy_status: 'approved',
    image_permission_status: 'approved',
    pharmacist_gate_status: 'approved',
    medical_advisor_gate_status: 'approved',
    compliance_gate_status: 'approved',
    ready_to_push: 'yes',
    owner: 'Product',
    source: 'unit test',
    confidence: 'high',
    last_updated: '2026-06-03',
    next_action: 'push'
  }]);

  return vaultPath;
}

function controlPlane() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aidlyst-control-plane-'));
  return new ControlPlane({
    auditStore: new FileAuditStore(path.join(root, 'audits')),
    catalogStore: new FileCatalogStore(path.join(root, 'catalog')),
    now: NOW
  });
}

test('imports vault CSVs, evaluates a stored push row, and reuses idempotent decisions', () => {
  const plane = controlPlane();
  const vaultPath = createVault();
  const imported = plane.importVault({ vaultPath });

  assert.equal(imported.stats.product_sourcing_pipeline.upserted, 1);
  assert.equal(plane.status().counts.products, 1);

  const first = plane.evaluateStored({ pushQueueId: 'PUSH-TEST-001' }, {
    action: 'publish',
    idempotencyKey: 'publish:first-aid'
  });
  assert.equal(first.result.authorization.publish.allowed, true);
  assert.equal(first.result.route.mode, 'affiliate');
  assert.equal(first.idempotent, false);
  assert.ok(first.decision.inputHash);
  assert.ok(first.result.audit.inputSnapshot);

  const second = plane.evaluateStored({ pushQueueId: 'PUSH-TEST-001' }, {
    action: 'publish',
    idempotencyKey: 'publish:first-aid'
  });
  assert.equal(second.idempotent, true);
  assert.equal(second.decision.id, first.decision.id);
});

test('creates a Shopify draft plan only after publishing authorization passes', () => {
  const plane = controlPlane();
  const vaultPath = createVault();
  plane.importVault({ vaultPath });

  const planned = plane.shopifyDraftPlanForStored({ pushQueueId: 'PUSH-TEST-001' });

  assert.equal(planned.plan.allowed, true);
  assert.equal(planned.plan.productSet.status, 'DRAFT');
  assert.equal(planned.plan.productSet.handle, 'first-aid-kit');
  assert.equal(planned.plan.productSet.metafields.some((field) => field.key === 'commerce_mode' && field.value === 'affiliate'), true);
});
