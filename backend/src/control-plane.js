const path = require('path');
const { readCsvFile } = require('./csv');
const { evaluateSku } = require('./domain');
const { buildPayloadFromRows } = require('./payload-builder');
const { buildShopifyDraftPlan } = require('./shopify-draft');
const { cloneJson, sha256 } = require('./json-utils');

const VAULT_DATASETS = {
  product_sourcing_pipeline: 'product_sourcing_pipeline.csv',
  supplier_vendor_dataset: 'supplier_vendor_dataset.csv',
  supplier_offer_rates: 'supplier_offer_rates.csv',
  shopify_product_push_queue: 'shopify_product_push_queue.csv'
};

function defaultVaultPath() {
  return path.join(__dirname, '..', '..', 'obsidian-vault');
}

function loadVaultDatasets(vaultPath = defaultVaultPath()) {
  const dataDir = path.join(vaultPath, '12 Business Datasets', 'CSV');
  return Object.fromEntries(Object.entries(VAULT_DATASETS).map(([name, fileName]) => [
    name,
    readCsvFile(path.join(dataDir, fileName))
  ]));
}

function actionAuthorization(result, action) {
  if (action === 'checkout') return result.authorization.checkout;
  if (action === 'publish' || action === 'shopify_draft_plan') return result.authorization.publish;
  return {
    action,
    allowed: result.authorization.publish.allowed || result.authorization.checkout.allowed,
    blockers: []
  };
}

class ControlPlane {
  constructor({ auditStore, catalogStore, now } = {}) {
    if (!auditStore) throw new TypeError('auditStore is required.');
    if (!catalogStore) throw new TypeError('catalogStore is required.');
    this.auditStore = auditStore;
    this.catalogStore = catalogStore;
    this.now = now;
  }

  clock() {
    return this.now instanceof Date ? new Date(this.now.getTime()) : new Date(this.now || Date.now());
  }

  importVault(options = {}) {
    const vaultPath = options.vaultPath || defaultVaultPath();
    const datasets = loadVaultDatasets(vaultPath);
    return this.catalogStore.importDatasets(datasets, vaultPath, this.clock());
  }

  status() {
    const catalog = this.catalogStore.loadCatalog();
    return {
      ok: true,
      importedAt: catalog.importedAt,
      source: catalog.source,
      contentHash: catalog.contentHash || null,
      counts: {
        products: Object.keys(catalog.products).length,
        suppliers: Object.keys(catalog.suppliers).length,
        offers: Object.keys(catalog.offers).length,
        pushQueue: Object.keys(catalog.pushQueue).length
      }
    };
  }

  resolveRows({ productCandidateId, supplierId, offerId, pushQueueId }) {
    const catalog = this.catalogStore.loadCatalog();
    let pushRow = pushQueueId ? catalog.pushQueue[pushQueueId] : null;
    let offer = offerId ? catalog.offers[offerId] : null;
    let product = productCandidateId ? catalog.products[productCandidateId] : null;
    let supplier = supplierId ? catalog.suppliers[supplierId] : null;

    if (pushRow) {
      product = product || catalog.products[pushRow.product_candidate_id];
      offer = offer || catalog.offers[pushRow.primary_offer_id];
    }

    if (offer) {
      product = product || catalog.products[offer.product_candidate_id];
      supplier = supplier || catalog.suppliers[offer.supplier_id];
    }

    if (!product) throw Object.assign(new Error('Product candidate not found.'), { statusCode: 404 });
    if (offerId || pushRow?.primary_offer_id) {
      if (!offer) throw Object.assign(new Error('Supplier offer not found.'), { statusCode: 404 });
    }

    return {
      product,
      supplier,
      offer,
      pushRow
    };
  }

  buildPayloadFromCatalog(reference) {
    return buildPayloadFromRows(this.resolveRows(reference));
  }

  evaluatePayload(payload, options = {}) {
    const idempotencyKey = options.idempotencyKey || '';
    const previous = this.catalogStore.getIdempotentDecision(idempotencyKey);
    if (previous) {
      return {
        idempotent: true,
        decision: previous,
        result: previous.result
      };
    }

    const now = this.clock();
    const result = evaluateSku(payload, { now });
    this.auditStore.save(result.audit);

    const action = options.action || 'evaluate';
    const authorization = actionAuthorization(result, action);
    const decision = {
      id: result.audit.id,
      type: 'commerce_control_decision',
      action,
      createdAt: now.toISOString(),
      source: options.source || 'api',
      idempotencyKey: idempotencyKey || null,
      inputHash: sha256(payload),
      auditId: result.audit.id,
      sku: result.sku,
      policyVersion: result.policyVersion,
      allowed: authorization.allowed,
      blockers: authorization.blockers,
      route: cloneJson(result.route),
      classification: cloneJson(result.classification),
      result: cloneJson(result)
    };

    this.catalogStore.saveDecision(decision);
    this.catalogStore.saveIdempotencyKey(idempotencyKey, decision.id);

    return {
      idempotent: false,
      decision,
      result
    };
  }

  evaluateStored(reference, options = {}) {
    const payload = this.buildPayloadFromCatalog(reference);
    return {
      payload,
      ...this.evaluatePayload(payload, {
        ...options,
        source: options.source || 'catalog'
      })
    };
  }

  evaluateBatch(payloads, options = {}) {
    if (!Array.isArray(payloads)) throw new TypeError('items must be an array.');
    return payloads.map((item, index) => {
      const payload = item.payload || item;
      const idempotencyKey = item.idempotencyKey || (options.idempotencyKey ? `${options.idempotencyKey}:${index}` : '');
      return this.evaluatePayload(payload, {
        action: item.action || options.action || 'evaluate',
        source: options.source || 'batch',
        idempotencyKey
      });
    });
  }

  shopifyDraftPlan(payload, options = {}) {
    const evaluation = this.evaluatePayload(payload, {
      ...options,
      action: 'shopify_draft_plan'
    });
    return {
      ...evaluation,
      plan: buildShopifyDraftPlan(evaluation.result, payload)
    };
  }

  shopifyDraftPlanForStored(reference, options = {}) {
    const payload = this.buildPayloadFromCatalog(reference);
    const plan = this.shopifyDraftPlan(payload, {
      ...options,
      source: options.source || 'catalog_shopify_plan'
    });
    return {
      payload,
      ...plan
    };
  }
}

module.exports = {
  ControlPlane,
  defaultVaultPath,
  loadVaultDatasets
};
