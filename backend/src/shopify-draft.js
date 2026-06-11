const { normalize } = require('./domain');

const REQUIRED_METAFIELDS = [
  ['custom', 'affiliate_url'],
  ['custom', 'commerce_mode'],
  ['custom', 'risk_level'],
  ['custom', 'last_checked'],
  ['custom', 'seller_of_record'],
  ['custom', 'fda_note'],
  ['custom', 'claim_notes'],
  ['custom', 'medical_advisor_status'],
  ['custom', 'pharmacist_recommendation_status'],
  ['custom', 'source_notes']
];

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function metafield(namespace, key, value, type = 'single_line_text_field') {
  return {
    namespace,
    key,
    type,
    value: value === null || value === undefined ? '' : String(value)
  };
}

function buildRequiredMetafields(result, input) {
  const product = input.product || {};
  const offer = input.offer || {};
  const gate = result.gates || {};
  const values = {
    affiliate_url: result.route.mode === 'affiliate' ? result.route.destination : '',
    commerce_mode: result.route.mode,
    risk_level: result.classification.riskLevel,
    last_checked: offer.last_checked || offer.lastChecked || result.evaluatedAt,
    seller_of_record: result.route.sellerOfRecord,
    fda_note: [product.fda_device_class, product.fda_product_code, product.regulatory_path].filter(Boolean).join(' | '),
    claim_notes: result.audit.evidence.filter((item) => item.type === 'claim').map((item) => item.text).join('\n'),
    medical_advisor_status: gate.review?.passed ? 'approved' : 'blocked',
    pharmacist_recommendation_status: product.pharmacist_recommended_status || input.gates?.pharmacistGateStatus || '',
    source_notes: result.audit.evidence.map((item) => item.url || item.summary || item.text).filter(Boolean).join('\n')
  };

  return REQUIRED_METAFIELDS.map(([namespace, key]) => {
    const type = key === 'affiliate_url' && values[key] ? 'url' : 'single_line_text_field';
    return metafield(namespace, key, values[key], type);
  });
}

function buildShopifyDraftPlan(result, input) {
  if (!result.authorization.publish.allowed) {
    return {
      action: 'blocked',
      allowed: false,
      reason: 'Publishing authorization failed.',
      blockers: result.authorization.publish.blockers,
      auditId: result.audit.id
    };
  }

  const product = input.product || {};
  const offer = input.offer || {};
  const handle = slugify(product.handle || product.name || result.sku);
  const price = normalize(result.route.mode) === 'direct_fulfillment' ? offer.total_landed_cost || offer.item_price || '' : '';

  return {
    action: 'shopify_product_set_draft',
    allowed: true,
    auditId: result.audit.id,
    productSet: {
      status: 'DRAFT',
      handle,
      title: product.name || result.sku,
      vendor: input.supplier?.name || 'Aidlyst',
      productType: product.product_type || product.category || '',
      tags: [
        'aidlyst-controlled',
        `risk-${result.classification.riskLevel}`,
        `commerce-${result.route.mode}`
      ],
      variants: price ? [{ sku: result.sku, price }] : [{ sku: result.sku }],
      metafields: buildRequiredMetafields(result, input)
    }
  };
}

module.exports = {
  REQUIRED_METAFIELDS,
  buildShopifyDraftPlan
};
