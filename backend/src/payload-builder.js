const { normalize } = require('./domain');

function normalizeSupplierType(type) {
  const value = normalize(type);
  if (value.includes('affiliate')) return 'affiliate_partner';
  if (value.includes('manufacturer')) return 'manufacturer';
  if (value.includes('retailer')) return 'retailer';
  if (value.includes('marketplace')) return 'marketplace';
  if (value.includes('distributor') || value.includes('supplier')) return 'supplier';
  if (value === 'platform') return 'marketplace';
  return value || 'supplier';
}

function sellerOfRecordFor({ pushRow, supplier }) {
  const commerceMode = normalize(pushRow?.commerce_mode || pushRow?.commerceMode);
  const supplierType = normalizeSupplierType(supplier?.type);

  if (commerceMode === 'affiliate') return 'affiliate_partner';
  if (commerceMode === 'lead_gen') return supplierType;
  if (commerceMode === 'manufacturer_direct') return 'manufacturer';
  if (commerceMode === 'retailer_checkout') return ['retailer', 'marketplace'].includes(supplierType) ? supplierType : 'retailer';
  if (commerceMode === 'direct' || commerceMode === 'direct_fulfillment') return 'aidlyst';
  return supplierType;
}

function buildPayloadFromRows({ product, supplier, offer, pushRow }) {
  if (!product) throw new Error('Product candidate is required.');

  const selectedMode = pushRow?.commerce_mode || product.commerce_mode_recommendation || offer?.commerce_mode || 'affiliate';
  const sellerOfRecord = sellerOfRecordFor({ pushRow: pushRow || { commerce_mode: selectedMode }, supplier: supplier || {} });
  const selectedAffiliateUrl = pushRow?.selected_affiliate_url || offer?.affiliate_url || '';

  return {
    sku: offer?.supplier_sku || pushRow?.shopify_handle || product.id,
    product: {
      id: product.id,
      name: product.name,
      category: product.category,
      subcategory: product.subcategory,
      product_type: product.product_type,
      otc_status: product.otc_status,
      regulatory_path: product.regulatory_path,
      fda_device_class: product.fda_device_class,
      fda_product_code: product.fda_product_code,
      rx_or_restricted_flag: product.rx_or_restricted_flag,
      intended_use_source: product.intended_use_source,
      claim_risk: product.claim_risk,
      pharmacist_recommended_status: product.pharmacist_recommended_status,
      pharmacist_reviewer: product.pharmacist_reviewer,
      medical_advisor_status: product.medical_advisor_status,
      commerce_mode_recommendation: selectedMode,
      evidence_summary: product.evidence_summary,
      source_links: product.source_links,
      status: product.status
    },
    supplier: supplier ? {
      id: supplier.id,
      name: supplier.name,
      type: normalizeSupplierType(supplier.type),
      originalType: supplier.type,
      status: supplier.status,
      verifiedAt: supplier.last_updated,
      categoryFocus: supplier.category_focus,
      monetizationFit: supplier.monetization_fit,
      riskLevel: supplier.risk_level
    } : {},
    offer: offer ? {
      id: offer.id,
      sku: offer.supplier_sku,
      gtin: offer.gtin,
      offer_url: offer.offer_url,
      affiliate_url: selectedAffiliateUrl,
      currency: offer.currency,
      item_price: offer.item_price,
      shipping_estimate: offer.shipping_estimate,
      total_landed_cost: offer.total_landed_cost,
      commission_rate: offer.commission_rate,
      availability: offer.availability,
      return_policy_summary: offer.return_policy_summary,
      source_url: offer.source_url || offer.offer_url,
      last_checked: offer.last_checked,
      fulfillment: {
        leadTime: offer.lead_time,
        status: offer.fulfillment_status || pushRow?.fulfillment_gate_status || ''
      }
    } : {},
    sellerOfRecord,
    commerceMode: selectedMode,
    affiliateUrl: selectedAffiliateUrl,
    gates: {
      sellerOfRecordStatus: pushRow?.seller_of_record_status || 'approved',
      complianceGateStatus: pushRow?.compliance_gate_status || '',
      labelingStatus: pushRow?.labeling_status || (product.intended_use_source ? 'approved' : ''),
      copyStatus: pushRow?.copy_status || '',
      imagePermissionStatus: pushRow?.image_permission_status || '',
      pharmacistGateStatus: pushRow?.pharmacist_gate_status || product.pharmacist_recommended_status || '',
      medicalAdvisorGateStatus: pushRow?.medical_advisor_gate_status || product.medical_advisor_status || '',
      reviewGateStatus: pushRow?.review_gate_status || ''
    },
    claims: product.evidence_summary ? [{ text: product.evidence_summary, sourceUrl: product.source_links || '' }] : [],
    sourceEvidence: [
      product.source_links ? { type: 'source', url: product.source_links, summary: product.evidence_summary || '' } : null,
      offer?.source_url ? { type: 'source', url: offer.source_url, summary: offer.rate_source || '' } : null
    ].filter(Boolean),
    sourceRows: {
      productCandidateId: product.id,
      supplierId: supplier?.id || '',
      offerId: offer?.id || '',
      pushQueueId: pushRow?.id || ''
    }
  };
}

module.exports = {
  buildPayloadFromRows,
  normalizeSupplierType
};
