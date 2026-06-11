const crypto = require('crypto');
const { cloneJson, sha256 } = require('./json-utils');

const POLICY_VERSION = 'aidlyst-commerce-control-2026-06-03';

const YES_VALUES = new Set(['1', 'active', 'approved', 'available', 'in_stock', 'ready', 'true', 'verified', 'yes']);
const NO_VALUES = new Set(['0', 'blocked', 'false', 'no', 'rejected', 'retired', 'unavailable']);
const APPROVED_VALUES = new Set(['approved', 'verified', 'ready', 'active', 'pass', 'passed']);
const BLOCKED_PRODUCT_STATUSES = new Set(['blocked', 'do_not_list', 'rejected', 'retired']);
const HIGH_RISK_TYPES = new Set([
  'a1c_home_test',
  'a1c_home_test_kit',
  'connected_clinical_device',
  'home_diagnostic_test',
  'home_test_kit',
  'inhaler_spacer',
  'nebulizer_machine',
  'otc_hearing_aid',
  'spirometer',
  'tens_unit'
]);
const MEDIUM_RISK_TYPES = new Set([
  'blood_pressure_accessory',
  'blood_pressure_monitor',
  'glucose_meter',
  'lancets',
  'lancing_device',
  'mobility_aid',
  'pulse_oximeter',
  'test_strips'
]);
const LOW_RISK_TYPES = new Set([
  'adhesive_bandages',
  'alcohol_prep_pads',
  'bandages',
  'first_aid_kit',
  'hearing_aid_batteries',
  'hearing_aid_cleaning_kit',
  'pill_organizer',
  'reading_glasses',
  'reacher_grabber',
  'sharps_container'
]);
const SAFE_COMMERCE_MODES = new Set([
  'affiliate',
  'lead_gen',
  'retailer_checkout',
  'manufacturer_direct',
  'direct_fulfillment',
  'do_not_list'
]);
const CHECKOUT_MODES = new Set(['retailer_checkout', 'manufacturer_direct', 'direct_fulfillment']);
const SELLER_OF_RECORD_TYPES = new Set([
  'affiliate_partner',
  'aidlyst',
  'manufacturer',
  'marketplace',
  'retailer',
  'supplier'
]);
const REQUIRED_DIRECT_SALE_FLAGS = [
  'sellerOfRecordPolicy',
  'supplierAgreement',
  'returnRefundProcess',
  'shippingFulfillmentProcess',
  'taxCollectionProcess',
  'productLiabilityReview',
  'productSafetyLabelingReview',
  'insuranceReview',
  'customerSupportWorkflow'
];
const UNSAFE_CLAIM_PATTERNS = [
  /\b(diagnose|diagnoses|diagnosing)\b/i,
  /\b(treat|treats|treated|treatment)\b/i,
  /\b(cure|cures|curing)\b/i,
  /\b(prevent|prevents|preventing)\b/i,
  /\b(prescribe|prescription recommendation)\b/i,
  /\bbest\s+(for|to)\s+[^.]*(diabetes|asthma|copd|hypertension|sleep apnea|infection|wound|pain)\b/i,
  /\bfda[-\s]?(approved|cleared|listed)\b/i,
  /\bclinically\s+recommended\b/i
];

function normalize(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

function compact(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function firstValue(source, aliases, fallback = '') {
  if (!source || typeof source !== 'object') return fallback;
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(source, alias) && compact(source[alias]) !== '') {
      return source[alias];
    }
  }
  return fallback;
}

function boolish(value) {
  const normalized = normalize(value);
  if (YES_VALUES.has(normalized)) return true;
  if (NO_VALUES.has(normalized)) return false;
  return false;
}

function isApproved(value) {
  return APPROVED_VALUES.has(normalize(value));
}

function isKnownBlank(value) {
  return ['n/a', 'na', 'none', 'unknown', 'unassigned', 'verify', 'needs_review'].includes(normalize(value));
}

function parseMoney(value) {
  if (value === null || value === undefined || compact(value) === '') return null;
  const parsed = Number(String(value).replace(/[$,]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  if (value === null || value === undefined || compact(value) === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function ageHours(value, now) {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return Math.max(0, (now.getTime() - parsed.getTime()) / 36e5);
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function redactForAudit(value) {
  if (Array.isArray(value)) return value.map((item) => redactForAudit(item));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (/(authorization|password|secret|token|api[_-]?key|access[_-]?key)/i.test(key)) {
      return [key, '[redacted]'];
    }
    return [key, redactForAudit(child)];
  }));
}

function collectEvidence(input) {
  const product = input.product || {};
  const offer = input.offer || {};
  const evidence = [];

  for (const item of asArray(input.sourceEvidence || product.sourceEvidence || product.source_evidence)) {
    if (typeof item === 'string') {
      evidence.push({ type: 'source', url: item });
    } else if (item && typeof item === 'object') {
      evidence.push({ type: item.type || 'source', url: item.url || item.sourceUrl || '', summary: item.summary || item.note || '' });
    }
  }

  const sourceLinks = firstValue(product, ['source_links', 'sourceLinks']);
  if (compact(sourceLinks) !== '') {
    evidence.push({ type: 'source', url: compact(sourceLinks) });
  }

  const evidenceSummary = firstValue(product, ['evidence_summary', 'evidenceSummary']);
  if (compact(evidenceSummary) !== '') {
    evidence.push({ type: 'source_summary', summary: compact(evidenceSummary) });
  }

  const intendedUseSource = firstValue(product, ['intended_use_source', 'intendedUseSource']);
  if (compact(intendedUseSource) !== '') {
    evidence.push({ type: 'labeling', summary: compact(intendedUseSource) });
  }

  const offerSource = firstValue(offer, ['source_url', 'sourceUrl', 'offer_url', 'offerUrl']);
  if (compact(offerSource) !== '') {
    evidence.push({ type: 'source', url: compact(offerSource) });
  }

  for (const claim of asArray(input.claims || product.claims)) {
    if (typeof claim === 'string') {
      evidence.push({ type: 'claim', text: claim });
    } else if (claim && typeof claim === 'object') {
      evidence.push({ type: 'claim', text: claim.text || claim.claim || '', sourceUrl: claim.sourceUrl || claim.source_url || '' });
    }
  }

  return evidence.filter((item) => compact(item.url || item.text || item.summary) !== '');
}

function productField(product, names) {
  return firstValue(product, names);
}

function classifyProductRisk(input) {
  const product = input.product || input || {};
  const productType = normalize(productField(product, ['productType', 'product_type', 'type']));
  const otcStatus = normalize(productField(product, ['otcStatus', 'otc_status']));
  const claimRisk = normalize(productField(product, ['claimRisk', 'claim_risk', 'riskLevel', 'risk_level']));
  const regulatoryPath = normalize(productField(product, ['regulatoryPath', 'regulatory_path']));
  const rxRestricted = boolish(productField(product, ['rxOrRestrictedFlag', 'rx_or_restricted_flag', 'restricted', 'prescriptionRequired']));
  const status = normalize(productField(product, ['status', 'productStatus', 'product_status']));
  const reasons = [];
  let riskLevel = 'medium';

  if (rxRestricted) {
    reasons.push('Product is marked prescription, restricted, or requires verification before public commerce.');
    return {
      riskLevel: 'prohibited',
      eligible: false,
      allowedCommerceModes: ['do_not_list'],
      reasons
    };
  }

  if (BLOCKED_PRODUCT_STATUSES.has(status)) {
    reasons.push(`Product status is ${status}.`);
    return {
      riskLevel: 'prohibited',
      eligible: false,
      allowedCommerceModes: ['do_not_list'],
      reasons
    };
  }

  if (claimRisk === 'prohibited' || claimRisk === 'prohibited_for_launch') {
    reasons.push('Claim risk is prohibited for launch.');
    return {
      riskLevel: 'prohibited',
      eligible: false,
      allowedCommerceModes: ['do_not_list'],
      reasons
    };
  }

  if (claimRisk === 'high' || HIGH_RISK_TYPES.has(productType)) {
    riskLevel = 'high';
    reasons.push('High medical or claim risk requires lead-gen or manual vendor review, not checkout.');
  } else if (claimRisk === 'low' || LOW_RISK_TYPES.has(productType) || otcStatus === 'wellness_device') {
    riskLevel = 'low';
    reasons.push('Low risk after compliance and source review.');
  } else if (claimRisk === 'medium' || MEDIUM_RISK_TYPES.has(productType) || otcStatus.includes('medical') || otcStatus.includes('drug')) {
    riskLevel = 'medium';
    reasons.push('Medical, OTC, or home-health product requires compliance gates before publish.');
  } else if (regulatoryPath.includes('verify') || otcStatus.includes('verify') || productType === '') {
    riskLevel = 'high';
    reasons.push('Classification is uncertain, so risk is raised until labeling and regulatory evidence are reviewed.');
  } else {
    riskLevel = 'medium';
    reasons.push('Defaulted to medium risk because this is a home-health commerce workflow.');
  }

  const allowedCommerceModes = riskLevel === 'high'
    ? ['lead_gen', 'do_not_list']
    : ['affiliate', 'lead_gen', 'retailer_checkout', 'manufacturer_direct', 'direct_fulfillment'];

  return {
    riskLevel,
    eligible: true,
    allowedCommerceModes,
    reasons
  };
}

function getGateStatus(input, aliases) {
  const gates = input.gates || {};
  return firstValue(gates, aliases) || firstValue(input, aliases);
}

function getSellerOfRecord(input) {
  return normalize(
    firstValue(input, ['sellerOfRecord', 'seller_of_record']) ||
    firstValue(input.supplier, ['sellerOfRecord', 'seller_of_record', 'type']) ||
    firstValue(input.offer, ['sellerOfRecord', 'seller_of_record'])
  );
}

function hasDirectSalesReadiness(input) {
  const readiness = input.directSalesReadiness || input.direct_sales_readiness || {};
  const missing = REQUIRED_DIRECT_SALE_FLAGS.filter((field) => !boolish(readiness[field]));
  return { ready: missing.length === 0, missing };
}

function determineRoute(input, classification) {
  const product = input.product || {};
  const supplier = input.supplier || {};
  const offer = input.offer || {};
  const requestedMode = normalize(
    firstValue(input, ['commerceMode', 'commerce_mode']) ||
    firstValue(product, ['commerceModeRecommendation', 'commerce_mode_recommendation']) ||
    firstValue(offer, ['commerceMode', 'commerce_mode'])
  );
  const sellerOfRecord = getSellerOfRecord(input);
  const affiliateUrl = compact(firstValue(input, ['affiliateUrl', 'affiliate_url', 'selected_affiliate_url']) || firstValue(offer, ['affiliateUrl', 'affiliate_url']));
  const retailerCheckoutUrl = compact(firstValue(input, ['retailerCheckoutUrl', 'retailer_checkout_url']) || firstValue(offer, ['retailerCheckoutUrl', 'retailer_checkout_url', 'offerUrl', 'offer_url']));
  const manufacturerDirectUrl = compact(firstValue(input, ['manufacturerDirectUrl', 'manufacturer_direct_url']) || firstValue(offer, ['manufacturerDirectUrl', 'manufacturer_direct_url']));
  const leadGenUrl = compact(firstValue(input, ['leadGenUrl', 'lead_gen_url']) || firstValue(supplier, ['leadGenUrl', 'lead_gen_url']));
  const reasons = [];
  let mode = 'do_not_list';
  let destination = '';

  if (!classification.eligible) {
    reasons.push('Product is not eligible for commerce routing.');
  } else if (requestedMode === 'do_not_list') {
    reasons.push('Structured rules requested do_not_list.');
  } else if (classification.riskLevel === 'high') {
    mode = leadGenUrl || sellerOfRecord === 'manufacturer' ? 'lead_gen' : 'do_not_list';
    destination = leadGenUrl;
    reasons.push(mode === 'lead_gen' ? 'High-risk products are routed to lead-gen only.' : 'High-risk product has no approved lead-gen destination.');
  } else if (requestedMode === 'affiliate' && affiliateUrl) {
    mode = 'affiliate';
    destination = affiliateUrl;
    reasons.push('Affiliate URL is present and allowed by risk rules.');
  } else if (requestedMode === 'retailer_checkout' && retailerCheckoutUrl) {
    mode = 'retailer_checkout';
    destination = retailerCheckoutUrl;
    reasons.push('Retailer checkout URL is present.');
  } else if (requestedMode === 'manufacturer_direct' && manufacturerDirectUrl) {
    mode = 'manufacturer_direct';
    destination = manufacturerDirectUrl;
    reasons.push('Manufacturer-direct fulfillment URL is present.');
  } else if (requestedMode === 'direct' || requestedMode === 'direct_fulfillment') {
    mode = 'direct_fulfillment';
    reasons.push('Direct fulfillment was requested and must pass seller-of-record readiness.');
  } else if (affiliateUrl) {
    mode = 'affiliate';
    destination = affiliateUrl;
    reasons.push('Defaulted to affiliate because an approved affiliate destination is available.');
  } else if (sellerOfRecord === 'retailer' && retailerCheckoutUrl) {
    mode = 'retailer_checkout';
    destination = retailerCheckoutUrl;
    reasons.push('Defaulted to retailer checkout because retailer is seller of record.');
  } else if (sellerOfRecord === 'manufacturer' && manufacturerDirectUrl) {
    mode = 'manufacturer_direct';
    destination = manufacturerDirectUrl;
    reasons.push('Defaulted to manufacturer-direct fulfillment because manufacturer is seller of record.');
  } else if (leadGenUrl) {
    mode = 'lead_gen';
    destination = leadGenUrl;
    reasons.push('Defaulted to lead-gen because no checkout-safe route exists.');
  } else {
    reasons.push('No valid affiliate, lead-gen, retailer, or manufacturer destination exists.');
  }

  if (!SAFE_COMMERCE_MODES.has(mode)) mode = 'do_not_list';

  return {
    mode,
    destination,
    sellerOfRecord,
    requestedMode: requestedMode || 'auto',
    reasons
  };
}

function newGate(name) {
  return {
    name,
    passed: true,
    blockers: [],
    warnings: [],
    evidence: []
  };
}

function fail(gate, message) {
  gate.passed = false;
  gate.blockers.push(message);
}

function warn(gate, message) {
  gate.warnings.push(message);
}

function evaluateSellerOfRecordGate(input, route) {
  const gate = newGate('seller_of_record');
  const sellerOfRecord = route.sellerOfRecord;
  const status = normalize(getGateStatus(input, ['sellerOfRecordStatus', 'seller_of_record_status']));

  if (!SELLER_OF_RECORD_TYPES.has(sellerOfRecord)) {
    fail(gate, 'Seller of record must be explicitly set to retailer, manufacturer, marketplace, supplier, affiliate_partner, or Aidlyst.');
  }

  if (status && !isApproved(status)) {
    fail(gate, `Seller-of-record gate is ${status}, not approved.`);
  }

  if (route.mode === 'direct_fulfillment' || sellerOfRecord === 'aidlyst') {
    const readiness = hasDirectSalesReadiness(input);
    if (!readiness.ready) {
      fail(gate, `Aidlyst direct checkout is blocked until direct-sales readiness is complete: ${readiness.missing.join(', ')}.`);
    }
  }

  if (route.mode === 'retailer_checkout' && !['retailer', 'marketplace'].includes(sellerOfRecord)) {
    fail(gate, 'Retailer checkout requires retailer or marketplace seller of record.');
  }

  if (route.mode === 'manufacturer_direct' && sellerOfRecord !== 'manufacturer') {
    fail(gate, 'Manufacturer-direct fulfillment requires manufacturer seller of record.');
  }

  return gate;
}

function evaluateComplianceGate(input, classification, evidence) {
  const product = input.product || {};
  const gate = newGate('compliance');
  const status = normalize(getGateStatus(input, ['complianceGateStatus', 'compliance_gate_status', 'complianceStatus', 'compliance_status']));
  const claimTexts = evidence.filter((item) => item.type === 'claim').map((item) => item.text || '');

  if (!classification.eligible || classification.riskLevel === 'prohibited') {
    fail(gate, 'Product is prohibited or ineligible under current launch policy.');
  }

  if (status && !isApproved(status)) {
    fail(gate, `Compliance gate is ${status}, not approved.`);
  } else if (!status) {
    fail(gate, 'Compliance gate status is missing.');
  }

  if (boolish(productField(product, ['rxOrRestrictedFlag', 'rx_or_restricted_flag']))) {
    fail(gate, 'Rx, restricted, or professionally supervised products cannot be published or checked out.');
  }

  if (!evidence.some((item) => item.type === 'source')) {
    fail(gate, 'Source evidence is required for medical-product claims and commerce routing.');
  }

  for (const text of claimTexts) {
    for (const pattern of UNSAFE_CLAIM_PATTERNS) {
      if (pattern.test(text)) {
        fail(gate, `Unsafe medical claim requires rewrite or legal review: "${text}".`);
        break;
      }
    }
  }

  if (claimTexts.length === 0) {
    warn(gate, 'No claim copy was supplied for backend claim screening.');
  }

  return gate;
}

function evaluateSupplierGate(input, route, now) {
  const supplier = input.supplier || {};
  const offer = input.offer || {};
  const gate = newGate('supplier');
  const supplierId = compact(firstValue(supplier, ['id', 'supplier_id', 'supplierId']));
  const supplierStatus = normalize(firstValue(supplier, ['status', 'supplierStatus', 'supplier_status']));
  const sourceUrl = compact(firstValue(offer, ['sourceUrl', 'source_url', 'offerUrl', 'offer_url']) || firstValue(supplier, ['sourceUrl', 'source_url']));
  const price = parseMoney(firstValue(offer, ['totalLandedCost', 'total_landed_cost', 'itemPrice', 'item_price', 'price', 'selected_price']));
  const availability = normalize(firstValue(offer, ['availability', 'stockStatus', 'stock_status']));
  const lastChecked = firstValue(offer, ['lastChecked', 'last_checked', 'checkedAt', 'checked_at']);
  const checkedAgeHours = ageHours(lastChecked, now);
  const supplierAgeHours = ageHours(firstValue(supplier, ['verifiedAt', 'verified_at', 'lastUpdated', 'last_updated']), now);

  if (!supplierId && compact(firstValue(supplier, ['name'])) === '') {
    fail(gate, 'Supplier or manufacturer record is required.');
  }

  if (supplierStatus && !['active', 'approved', 'verified'].includes(supplierStatus)) {
    fail(gate, `Supplier status is ${supplierStatus}; only active, approved, or verified suppliers may route commerce.`);
  } else if (!supplierStatus) {
    fail(gate, 'Supplier status is missing.');
  }

  if (!sourceUrl) {
    fail(gate, 'Supplier offer source URL is required.');
  }

  if (route.mode !== 'lead_gen' && (price === null || price <= 0)) {
    fail(gate, 'A current numeric price is required for affiliate, retailer, manufacturer, or direct fulfillment routes.');
  } else if (route.mode === 'lead_gen' && (price === null || price <= 0)) {
    warn(gate, 'Lead-gen route has no current display price; keep pricing out of public copy.');
  }

  if (['unavailable', 'out_of_stock', 'discontinued'].includes(availability)) {
    fail(gate, `Offer availability is ${availability}.`);
  } else if (!availability) {
    fail(gate, 'Offer availability is missing.');
  }

  if (checkedAgeHours === null) {
    fail(gate, 'Offer last_checked must be a valid date.');
  } else if (checkedAgeHours > 24 * 7) {
    fail(gate, 'Offer freshness is older than 7 days and cannot be used for publishing or checkout.');
  } else if (checkedAgeHours > 24) {
    warn(gate, 'Offer is older than 24 hours; refresh before using live pricing language.');
  }

  if (supplierAgeHours !== null && supplierAgeHours > 24 * 90) {
    warn(gate, 'Supplier verification is older than 90 days.');
  }

  gate.evidence.push({ supplierId, sourceUrl, price, availability, lastChecked: compact(lastChecked) });
  return gate;
}

function evaluateLabelingGate(input) {
  const product = input.product || {};
  const gate = newGate('labeling');
  const status = normalize(getGateStatus(input, ['labelingStatus', 'labeling_status']));
  const otcStatus = normalize(productField(product, ['otcStatus', 'otc_status']));
  const regulatoryPath = normalize(productField(product, ['regulatoryPath', 'regulatory_path']));
  const fdaClass = normalize(productField(product, ['fdaDeviceClass', 'fda_device_class']));
  const fdaProductCode = normalize(productField(product, ['fdaProductCode', 'fda_product_code']));
  const intendedUseSource = normalize(productField(product, ['intendedUseSource', 'intended_use_source', 'labelingSource', 'labeling_source']));

  if (status && !isApproved(status)) {
    fail(gate, `Labeling gate is ${status}, not approved.`);
  } else if (!status) {
    fail(gate, 'Labeling gate status is missing.');
  }

  if (!intendedUseSource || isKnownBlank(intendedUseSource)) {
    fail(gate, 'Manufacturer labeling, Drug Facts, or intended-use evidence must be recorded.');
  }

  if (otcStatus === 'otc_drug' && !regulatoryPath.includes('drug_facts')) {
    fail(gate, 'OTC drug products require Drug Facts or monograph evidence.');
  }

  if (otcStatus === 'otc_medical_device' && (isKnownBlank(fdaClass) || isKnownBlank(fdaProductCode))) {
    fail(gate, 'OTC medical-device products require reviewed FDA class or product-code evidence.');
  }

  return gate;
}

function evaluateReviewGate(input, classification) {
  const product = input.product || {};
  const gate = newGate('review');
  const copyStatus = normalize(getGateStatus(input, ['copyStatus', 'copy_status']));
  const imageStatus = normalize(getGateStatus(input, ['imagePermissionStatus', 'image_permission_status']));
  const pharmacistStatus = normalize(getGateStatus(input, ['pharmacistGateStatus', 'pharmacist_gate_status']) || productField(product, ['pharmacistRecommendedStatus', 'pharmacist_recommended_status']));
  const pharmacistReviewer = compact(productField(product, ['pharmacistReviewer', 'pharmacist_reviewer']));
  const medicalAdvisorStatus = normalize(getGateStatus(input, ['medicalAdvisorGateStatus', 'medical_advisor_gate_status']) || productField(product, ['medicalAdvisorStatus', 'medical_advisor_status']));
  const reviewStatus = normalize(getGateStatus(input, ['reviewGateStatus', 'review_gate_status']));

  if (!isApproved(copyStatus)) fail(gate, 'Product copy must be approved.');
  if (!['approved', 'licensed', 'not_required', 'verified'].includes(imageStatus)) fail(gate, 'Image permission must be approved, licensed, verified, or not_required.');
  if (!isApproved(medicalAdvisorStatus)) fail(gate, 'Medical advisor gate must be approved for medical/home-health products.');

  if (pharmacistStatus === 'recommended' || pharmacistStatus === 'approved') {
    if (isKnownBlank(pharmacistReviewer) || pharmacistReviewer === '') {
      fail(gate, 'Pharmacist recommendation requires a named reviewer or approved review source.');
    }
  } else if (classification.riskLevel !== 'low') {
    fail(gate, 'Medium/high-risk products require pharmacist gate approval or an approved recommendation source.');
  }

  if (reviewStatus && !isApproved(reviewStatus)) {
    fail(gate, `Review gate is ${reviewStatus}, not approved.`);
  }

  return gate;
}

function evaluateFulfillmentGate(input, route, now) {
  const offer = input.offer || {};
  const fulfillment = input.fulfillment || offer.fulfillment || {};
  const gate = newGate('fulfillment');
  const returnTerms = compact(firstValue(offer, ['returnPolicySummary', 'return_policy_summary', 'returnTerms', 'return_terms']));
  const leadTime = compact(firstValue(fulfillment, ['leadTimeDays', 'lead_time_days', 'leadTime', 'lead_time']) || firstValue(offer, ['leadTime', 'lead_time']));
  const readiness = normalize(firstValue(fulfillment, ['status', 'readiness', 'fulfillmentReadiness', 'fulfillment_readiness']) || getGateStatus(input, ['fulfillmentGateStatus', 'fulfillment_gate_status']));
  const inventory = firstValue(fulfillment, ['inventoryQuantity', 'inventory_quantity', 'inventory']);
  const lastChecked = firstValue(offer, ['lastChecked', 'last_checked', 'checkedAt', 'checked_at']);
  const checkedAgeHours = ageHours(lastChecked, now);

  if (!CHECKOUT_MODES.has(route.mode)) {
    warn(gate, `Fulfillment readiness is not required for ${route.mode} route, but it is still recorded when present.`);
    return gate;
  }

  if (!returnTerms) fail(gate, 'Return terms are required before checkout or manufacturer fulfillment.');
  if (!leadTime) fail(gate, 'Lead time is required before checkout or manufacturer fulfillment.');
  if (readiness && !isApproved(readiness)) fail(gate, `Fulfillment readiness is ${readiness}, not approved.`);
  if (!readiness) fail(gate, 'Fulfillment readiness status is missing.');

  const parsedInventory = Number(inventory);
  if (compact(inventory) !== '' && Number.isFinite(parsedInventory) && parsedInventory <= 0) {
    fail(gate, 'Inventory quantity must be positive for checkout-enabled routes.');
  }

  if (checkedAgeHours === null || checkedAgeHours > 24) {
    fail(gate, 'Checkout-enabled routes require offer freshness within 24 hours.');
  }

  return gate;
}

function evaluateGates(input, classification, route, evidence, now) {
  const gates = [
    evaluateSellerOfRecordGate(input, route),
    evaluateComplianceGate(input, classification, evidence),
    evaluateSupplierGate(input, route, now),
    evaluateLabelingGate(input),
    evaluateReviewGate(input, classification),
    evaluateFulfillmentGate(input, route, now)
  ];

  return Object.fromEntries(gates.map((gate) => [gate.name, gate]));
}

function authorizeAction(action, route, gates) {
  const required = ['seller_of_record', 'compliance', 'supplier', 'labeling', 'review'];
  const blockers = [];

  if (route.mode === 'do_not_list') {
    blockers.push('Commerce route is do_not_list.');
  }

  if (action === 'checkout') {
    if (!CHECKOUT_MODES.has(route.mode)) {
      blockers.push(`${route.mode} is not a checkout-enabled route.`);
    }
    required.push('fulfillment');
  }

  for (const name of required) {
    if (!gates[name]?.passed) {
      blockers.push(...(gates[name]?.blockers || [`${name} gate failed.`]));
    }
  }

  return {
    action,
    allowed: blockers.length === 0,
    blockers
  };
}

function createAuditTrail(input, classification, route, gates, authorization, evidence, now) {
  const auditId = crypto.randomUUID();
  const sku = compact(input.sku || input.id || firstValue(input.product, ['sku', 'id']) || firstValue(input.offer, ['sku', 'id']));
  const events = [
    {
      type: 'input.received',
      at: now.toISOString(),
      sku,
      inputHash: sha256(input)
    },
    {
      type: 'risk.classified',
      at: now.toISOString(),
      sku,
      riskLevel: classification.riskLevel,
      eligible: classification.eligible,
      reasons: classification.reasons
    },
    ...Object.values(gates).map((gate) => ({
      type: 'gate.evaluated',
      at: now.toISOString(),
      sku,
      gate: gate.name,
      passed: gate.passed,
      blockers: gate.blockers,
      warnings: gate.warnings
    })),
    {
      type: 'commerce.routed',
      at: now.toISOString(),
      sku,
      mode: route.mode,
      sellerOfRecord: route.sellerOfRecord,
      destinationPresent: route.destination !== '',
      reasons: route.reasons
    },
    {
      type: 'authorization.evaluated',
      at: now.toISOString(),
      sku,
      publishAllowed: authorization.publish.allowed,
      checkoutAllowed: authorization.checkout.allowed,
      publishBlockers: authorization.publish.blockers,
      checkoutBlockers: authorization.checkout.blockers
    }
  ];

  return {
    id: auditId,
    policyVersion: POLICY_VERSION,
    createdAt: now.toISOString(),
    inputHash: sha256(input),
    inputSnapshot: redactForAudit(cloneJson(input)),
    evidenceHash: sha256(evidence),
    sku,
    commerceMode: route.mode,
    riskLevel: classification.riskLevel,
    evidence,
    events
  };
}

function evaluateSku(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Payload must be a JSON object.');
  }

  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const classification = classifyProductRisk(input);
  const route = determineRoute(input, classification);
  const evidence = collectEvidence(input);
  const gates = evaluateGates(input, classification, route, evidence, now);
  const authorization = {
    publish: authorizeAction('publish', route, gates),
    checkout: authorizeAction('checkout', route, gates)
  };
  const audit = createAuditTrail(input, classification, route, gates, authorization, evidence, now);

  return {
    sku: audit.sku,
    policyVersion: POLICY_VERSION,
    evaluatedAt: now.toISOString(),
    classification,
    route,
    gates,
    authorization,
    audit
  };
}

module.exports = {
  CHECKOUT_MODES,
  POLICY_VERSION,
  authorizeAction,
  classifyProductRisk,
  determineRoute,
  evaluateSku,
  normalize
};
