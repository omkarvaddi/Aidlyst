const assert = require('node:assert/strict');
const test = require('node:test');
const { evaluateSku } = require('../src/domain');

const NOW = new Date('2026-06-03T12:00:00.000Z');

function basePayload(overrides = {}) {
  return {
    sku: 'SKU-BP-001',
    product: {
      id: 'PSC-001',
      name: 'Upper Arm Blood Pressure Monitor',
      product_type: 'blood_pressure_monitor',
      otc_status: 'otc_medical_device',
      regulatory_path: 'verify_fda_status',
      fda_device_class: 'class_ii',
      fda_product_code: 'DXN',
      rx_or_restricted_flag: 'no',
      intended_use_source: 'manufacturer_labeling_reviewed',
      claim_risk: 'medium',
      pharmacist_recommended_status: 'approved',
      pharmacist_reviewer: 'Dr. Example',
      medical_advisor_status: 'approved',
      commerce_mode_recommendation: 'retailer_checkout',
      source_links: 'https://manufacturer.example/product'
    },
    supplier: {
      id: 'VEN-retailer',
      name: 'Approved Retailer',
      type: 'retailer',
      status: 'active',
      verifiedAt: '2026-06-01'
    },
    offer: {
      offer_url: 'https://retailer.example/bp-monitor',
      source_url: 'https://retailer.example/bp-monitor',
      currency: 'USD',
      item_price: '49.99',
      total_landed_cost: '55.99',
      availability: 'available',
      return_policy_summary: '30-day returns through retailer',
      last_checked: '2026-06-03T06:00:00.000Z',
      fulfillment: {
        status: 'approved',
        leadTimeDays: 3,
        inventoryQuantity: 12
      }
    },
    sellerOfRecord: 'retailer',
    gates: {
      sellerOfRecordStatus: 'approved',
      complianceGateStatus: 'approved',
      labelingStatus: 'approved',
      copyStatus: 'approved',
      imagePermissionStatus: 'approved',
      medicalAdvisorGateStatus: 'approved',
      pharmacistGateStatus: 'approved',
      reviewGateStatus: 'approved',
      fulfillmentGateStatus: 'approved'
    },
    claims: [
      {
        text: 'Compare cuff size, display readability, current price, shipping, and return policy.',
        sourceUrl: 'https://manufacturer.example/product'
      }
    ],
    ...overrides
  };
}

test('authorizes an approved retailer-checkout SKU and writes a complete audit trail', () => {
  const result = evaluateSku(basePayload(), { now: NOW });

  assert.equal(result.classification.riskLevel, 'medium');
  assert.equal(result.route.mode, 'retailer_checkout');
  assert.equal(result.authorization.publish.allowed, true);
  assert.equal(result.authorization.checkout.allowed, true);
  assert.equal(result.gates.seller_of_record.passed, true);
  assert.equal(result.gates.fulfillment.passed, true);
  assert.ok(result.audit.id);
  assert.equal(result.audit.events.some((event) => event.type === 'risk.classified'), true);
  assert.equal(result.audit.events.some((event) => event.type === 'commerce.routed'), true);
});

test('blocks publishing and checkout when required review gates are missing', () => {
  const result = evaluateSku(basePayload({
    gates: {
      sellerOfRecordStatus: 'approved',
      complianceGateStatus: 'approved',
      labelingStatus: 'approved',
      copyStatus: 'needs_review',
      imagePermissionStatus: 'approved',
      medicalAdvisorGateStatus: 'needs_review',
      pharmacistGateStatus: 'needs_review'
    }
  }), { now: NOW });

  assert.equal(result.gates.review.passed, false);
  assert.equal(result.authorization.publish.allowed, false);
  assert.equal(result.authorization.checkout.allowed, false);
  assert.match(result.authorization.publish.blockers.join(' '), /Product copy must be approved/);
});

test('routes high-risk products to lead-gen and blocks checkout', () => {
  const payload = basePayload({
    product: {
      ...basePayload().product,
      product_type: 'home_test_kit',
      claim_risk: 'high',
      commerce_mode_recommendation: 'lead_gen'
    },
    supplier: {
      ...basePayload().supplier,
      type: 'manufacturer',
      leadGenUrl: 'https://manufacturer.example/request-info'
    },
    offer: {
      ...basePayload().offer,
      item_price: '',
      total_landed_cost: '',
      fulfillment: {}
    },
    sellerOfRecord: 'manufacturer'
  });
  const result = evaluateSku(payload, { now: NOW });

  assert.equal(result.classification.riskLevel, 'high');
  assert.equal(result.route.mode, 'lead_gen');
  assert.equal(result.authorization.publish.allowed, true);
  assert.equal(result.authorization.checkout.allowed, false);
  assert.match(result.authorization.checkout.blockers.join(' '), /not a checkout-enabled route/);
});

test('blocks restricted products regardless of supplier and review status', () => {
  const result = evaluateSku(basePayload({
    product: {
      ...basePayload().product,
      rx_or_restricted_flag: 'yes',
      claim_risk: 'low'
    }
  }), { now: NOW });

  assert.equal(result.classification.riskLevel, 'prohibited');
  assert.equal(result.route.mode, 'do_not_list');
  assert.equal(result.authorization.publish.allowed, false);
  assert.match(result.authorization.publish.blockers.join(' '), /prohibited|do_not_list/i);
});

test('blocks stale supplier offers before publish and checkout', () => {
  const result = evaluateSku(basePayload({
    offer: {
      ...basePayload().offer,
      last_checked: '2026-05-01T00:00:00.000Z'
    }
  }), { now: NOW });

  assert.equal(result.gates.supplier.passed, false);
  assert.equal(result.authorization.publish.allowed, false);
  assert.match(result.gates.supplier.blockers.join(' '), /older than 7 days/);
});

test('blocks unsupported medical claims and records the claim in audit evidence', () => {
  const result = evaluateSku(basePayload({
    claims: ['This monitor treats hypertension and prevents complications.']
  }), { now: NOW });

  assert.equal(result.gates.compliance.passed, false);
  assert.equal(result.authorization.publish.allowed, false);
  assert.equal(result.audit.evidence.some((item) => item.type === 'claim'), true);
});
