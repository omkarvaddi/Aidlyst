const { normalize } = require('./domain');

function percentage(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function countBy(rows, key) {
  return rows.reduce((accumulator, row) => {
    const value = normalize(row[key]) || 'unknown';
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});
}

function staleOfferCount(offers, now) {
  return offers.filter((offer) => {
    const checked = new Date(offer.last_checked || offer.lastChecked || 0);
    if (Number.isNaN(checked.valueOf())) return true;
    return (now.getTime() - checked.getTime()) > 24 * 60 * 60 * 1000;
  }).length;
}

function reviewBlockerCount(products) {
  return products.filter((product) => {
    return normalize(product.medical_advisor_status) !== 'approved' ||
      !['approved', 'recommended'].includes(normalize(product.pharmacist_recommended_status)) ||
      ['high', 'prohibited', 'prohibited_for_launch'].includes(normalize(product.claim_risk)) ||
      ['yes', 'true', '1', 'verify'].includes(normalize(product.rx_or_restricted_flag));
  }).length;
}

function latestDecisions(catalogStore, limit = 8) {
  const fs = require('fs');
  if (!fs.existsSync(catalogStore.decisionLogPath)) return [];
  const lines = fs.readFileSync(catalogStore.decisionLogPath, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.slice(-limit).reverse().map((line) => {
    const decision = JSON.parse(line);
    return {
      id: decision.id,
      action: decision.action,
      sku: decision.sku,
      routeMode: decision.route?.mode || '',
      riskLevel: decision.classification?.riskLevel || '',
      allowed: decision.allowed,
      blockers: decision.blockers || [],
      createdAt: decision.createdAt
    };
  });
}

function executiveActions(metrics) {
  return [
    {
      id: 'refresh_catalog',
      label: 'Refresh Research Data',
      intent: 'Import the latest Obsidian product, supplier, offer, and push-readiness datasets into the control plane.',
      enabled: true
    },
    {
      id: 'review_blockers',
      label: 'Review Blockers',
      intent: 'Open the compliance and supplier blockers that prevent publish-safe routing.',
      enabled: metrics.summary.blockedProducts > 0
    },
    {
      id: 'export_audit_summary',
      label: 'Export Audit Summary',
      intent: 'Prepare a CEO audit summary from recent policy decisions and gate outcomes.',
      enabled: true
    }
  ];
}

class DashboardService {
  constructor({ controlPlane }) {
    if (!controlPlane) throw new TypeError('controlPlane is required.');
    this.controlPlane = controlPlane;
  }

  metricsForRole(role) {
    const now = new Date();
    const catalog = this.controlPlane.catalogStore.loadCatalog();
    const products = Object.values(catalog.products || {});
    const suppliers = Object.values(catalog.suppliers || {});
    const offers = Object.values(catalog.offers || {});
    const pushQueue = Object.values(catalog.pushQueue || {});
    const productRisk = countBy(products, 'claim_risk');
    const supplierStatus = countBy(suppliers, 'status');
    const commerceModes = countBy(pushQueue, 'commerce_mode');
    const blockedProducts = reviewBlockerCount(products);
    const readyPushRows = pushQueue.filter((row) => ['yes', 'true', 'ready', 'approved'].includes(normalize(row.ready_to_push)));
    const readyToPush = readyPushRows.length;
    const publicProductIds = new Set(readyPushRows.map((row) => row.product_candidate_id).filter(Boolean));
    const publicProducts = products.filter((product) => publicProductIds.has(product.id));
    const staleOffers = staleOfferCount(offers, now);
    const recentDecisions = latestDecisions(this.controlPlane.catalogStore);

    const metrics = {
      generatedAt: now.toISOString(),
      role,
      summary: {
        productCandidates: products.length,
        suppliers: suppliers.length,
        supplierOffers: offers.length,
        pushQueueRows: pushQueue.length,
        publicProductRecords: readyToPush,
        publishReadyRows: readyToPush,
        blockedProducts,
        complianceReadiness: percentage(products.length - blockedProducts, products.length),
        offerFreshness: percentage(offers.length - staleOffers, offers.length)
      },
      productPipeline: {
        riskDistribution: productRisk,
        candidateCount: products.length,
        blockedCount: blockedProducts,
        readyToPush
      },
      supplierNetwork: {
        statusDistribution: supplierStatus,
        totalSuppliers: suppliers.length,
        totalOffers: offers.length,
        staleOffers
      },
      commerceRouting: {
        modes: commerceModes,
        checkoutModes: ['retailer_checkout', 'manufacturer_direct', 'direct_fulfillment'],
        defaultBlockedWhenMissingOffer: true
      },
      complianceGates: {
        required: ['seller_of_record', 'compliance', 'supplier', 'labeling', 'review', 'fulfillment'],
        blockedProducts,
        policyVersion: this.controlPlane.status().contentHash
      },
      auditTrail: {
        recentDecisions
      },
      finance: {
        affiliateRevenueTracked: 0,
        directRevenueTracked: 0,
        estimatedPipelineValue: offers.reduce((total, offer) => total + Number(offer.total_landed_cost || 0), 0)
      }
    };

    if (role === 'customer') {
      return {
        generatedAt: metrics.generatedAt,
        role,
        account: {
          savedProductPaths: 0,
          temporaryPreferenceCache: 'Session-only',
          savedPreferenceConsent: 'Not enabled',
          healthDataStorage: 'Do not store raw medical details',
          publicProductRecords: readyToPush,
          productResearchAvailable: readyToPush,
          checkoutEnabled: false,
          message: readyToPush
            ? 'Public product records are available for gated research only. Guest preferences stay temporary unless a customer opts in to saved product preferences.'
            : 'No public product records are available yet. Aidlyst is still verifying sourcing and supplier evidence while keeping customer product-fit data temporary by default.'
        },
        privacy: {
          defaultCustomerDataMode: 'temporary_preference_cache',
          durablePersonalizationRequiresConsent: true,
          rawHealthNarrativesStored: false,
          deletionPathRequired: true
        },
        productCategories: readyToPush ? Object.keys(countBy(publicProducts, 'category')).slice(0, 8) : []
      };
    }

    return {
      ...metrics,
      actions: role === 'ceo' ? executiveActions(metrics) : [],
      permissions: {
        canExecuteActions: role === 'ceo',
        readOnly: role === 'employee'
      }
    };
  }

  executeAction(actionId) {
    if (actionId === 'refresh_catalog') {
      return {
        actionId,
        status: 'completed',
        result: this.controlPlane.importVault()
      };
    }

    if (actionId === 'review_blockers') {
      const metrics = this.metricsForRole('ceo');
      return {
        actionId,
        status: 'prepared',
        result: {
          blockedProducts: metrics.operations?.blockedProducts || metrics.summary.blockedProducts,
          nextStep: 'Review product candidates with missing supplier offers, compliance approvals, medical advisor approval, or pharmacist review.'
        }
      };
    }

    if (actionId === 'export_audit_summary') {
      const metrics = this.metricsForRole('ceo');
      return {
        actionId,
        status: 'prepared',
        result: {
          generatedAt: metrics.generatedAt,
          recentDecisionCount: metrics.auditTrail.recentDecisions.length,
          summary: metrics.summary
        }
      };
    }

    throw Object.assign(new Error('Unknown dashboard action.'), { statusCode: 404 });
  }
}

module.exports = {
  DashboardService
};
