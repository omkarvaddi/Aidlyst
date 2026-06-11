const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { FileAuditStore } = require('../src/audit-store');
const { createServer } = require('../src/server');

function request(baseUrl, pathname, options = {}) {
  return fetch(new URL(pathname, baseUrl), {
    method: options.method || 'GET',
    headers: {
      ...(options.headers || {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}

function payload() {
  return {
    sku: 'SKU-FIRST-AID-001',
    product: {
      name: 'First Aid Kit',
      product_type: 'first_aid_kit',
      otc_status: 'otc_health_supply',
      regulatory_path: 'verify_product_labeling',
      rx_or_restricted_flag: 'no',
      intended_use_source: 'manufacturer_labeling_reviewed',
      claim_risk: 'low',
      pharmacist_reviewer: 'Approved review source',
      medical_advisor_status: 'approved',
      commerce_mode_recommendation: 'affiliate',
      source_links: 'https://manufacturer.example/first-aid'
    },
    supplier: {
      id: 'VEN-affiliate',
      type: 'affiliate_partner',
      status: 'active',
      verifiedAt: '2026-06-02'
    },
    offer: {
      affiliate_url: 'https://retailer.example/first-aid?tag=aidlyst-20',
      source_url: 'https://retailer.example/first-aid',
      item_price: '18.00',
      total_landed_cost: '18.00',
      availability: 'available',
      return_policy_summary: 'Retailer policy applies',
      last_checked: '2026-06-03T10:00:00.000Z'
    },
    sellerOfRecord: 'affiliate_partner',
    gates: {
      sellerOfRecordStatus: 'approved',
      complianceGateStatus: 'approved',
      labelingStatus: 'approved',
      copyStatus: 'approved',
      imagePermissionStatus: 'approved',
      medicalAdvisorGateStatus: 'approved',
      pharmacistGateStatus: 'approved'
    },
    claims: ['Compare kit contents, retailer price, shipping, and return terms.']
  };
}

function retailerCheckoutPayload() {
  const input = payload();
  input.sku = 'SKU-FIRST-AID-RETAILER-001';
  input.product.commerce_mode_recommendation = 'retailer_checkout';
  input.supplier = {
    id: 'RET-retailer',
    type: 'retailer',
    status: 'active',
    verifiedAt: '2026-06-03T10:00:00.000Z'
  };
  input.offer = {
    retailer_checkout_url: 'https://retailer.example/cart/first-aid',
    offer_url: 'https://retailer.example/first-aid',
    source_url: 'https://retailer.example/first-aid',
    item_price: '18.00',
    total_landed_cost: '22.00',
    availability: 'available',
    return_policy_summary: 'Retailer accepts unopened returns within 30 days.',
    lead_time: '2-4 days',
    last_checked: '2026-06-03T10:00:00.000Z'
  };
  input.fulfillment = {
    status: 'ready',
    leadTimeDays: '3',
    inventoryQuantity: '14'
  };
  input.sellerOfRecord = 'retailer';
  input.gates.fulfillmentGateStatus = 'approved';
  return input;
}

test('server exposes health, authorization, and audit readback', async (t) => {
  const auditDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidlyst-audits-'));
  const controlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidlyst-control-'));
  const server = createServer({
    auditStore: new FileAuditStore(auditDir),
    controlDir,
    now: new Date('2026-06-03T12:00:00.000Z')
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const health = await request(baseUrl, '/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  const status = await request(baseUrl, '/v1/control-plane/status');
  assert.equal(status.status, 200);
  assert.equal((await status.json()).counts.products, 0);

  const publish = await request(baseUrl, '/v1/authorize-publishing', {
    method: 'POST',
    body: payload()
  });
  assert.equal(publish.status, 200);
  const publishBody = await publish.json();
  assert.equal(publishBody.authorization.allowed, true);
  assert.ok(publishBody.auditId);

  const audit = await request(baseUrl, `/v1/audits/${publishBody.auditId}`);
  assert.equal(audit.status, 200);
  const auditBody = await audit.json();
  assert.equal(auditBody.sku, 'SKU-FIRST-AID-001');
  assert.equal(auditBody.commerceMode, 'affiliate');
  assert.ok(auditBody.inputHash);

  const blockedCheckout = await request(baseUrl, '/v1/authorize-checkout', {
    method: 'POST',
    body: payload()
  });
  assert.equal(blockedCheckout.status, 409);
  const blockedCheckoutBody = await blockedCheckout.json();
  assert.equal(blockedCheckoutBody.authorization.allowed, false);
  assert.match(blockedCheckoutBody.authorization.blockers.join(' '), /not a checkout-enabled route/);

  const allowedCheckout = await request(baseUrl, '/v1/authorize-checkout', {
    method: 'POST',
    body: retailerCheckoutPayload()
  });
  assert.equal(allowedCheckout.status, 200);
  const allowedCheckoutBody = await allowedCheckout.json();
  assert.equal(allowedCheckoutBody.authorization.allowed, true);
  assert.equal(allowedCheckoutBody.route.mode, 'retailer_checkout');
  assert.ok(allowedCheckoutBody.auditId);

  const batch = await request(baseUrl, '/v1/batch/evaluate-sku', {
    method: 'POST',
    body: { items: [payload()] }
  });
  assert.equal(batch.status, 200);
  assert.equal((await batch.json()).count, 1);

  const draftPlan = await request(baseUrl, '/v1/shopify/draft-plan', {
    method: 'POST',
    body: { payload: payload() }
  });
  assert.equal(draftPlan.status, 200);
  assert.equal((await draftPlan.json()).plan.productSet.status, 'DRAFT');
});

test('protected runtime rejects unauthenticated internet-facing requests', async (t) => {
  const auditDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidlyst-protected-audits-'));
  const controlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidlyst-protected-control-'));
  const apiKey = 'test_backend_api_key_32_chars_min';
  const server = createServer({
    apiKey,
    auditStore: new FileAuditStore(auditDir),
    controlDir,
    enableDevAuth: false,
    requireApiKey: true,
    now: new Date('2026-06-03T12:00:00.000Z')
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const health = await request(baseUrl, '/health');
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.protected, true);
  assert.equal(healthBody.devAuthEnabled, false);

  const login = await request(baseUrl, '/v1/auth/login', {
    method: 'POST',
    body: {
      email: 'ceo@aidlyst.local',
      password: 'test-password-only',
      role: 'ceo'
    }
  });
  assert.equal(login.status, 404);

  const unauthenticatedStatus = await request(baseUrl, '/v1/control-plane/status');
  assert.equal(unauthenticatedStatus.status, 401);

  const authenticatedStatus = await request(baseUrl, '/v1/control-plane/status', {
    headers: {
      'X-Aidlyst-Api-Key': apiKey
    }
  });
  assert.equal(authenticatedStatus.status, 200);
  assert.equal((await authenticatedStatus.json()).ok, true);
});
