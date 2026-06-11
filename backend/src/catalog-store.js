const fs = require('fs');
const path = require('path');
const { cloneJson, sha256 } = require('./json-utils');

const STORE_VERSION = 'aidlyst-control-plane-store-2026-06-04';
const COLLECTIONS = ['products', 'suppliers', 'offers', 'pushQueue'];

function emptyCatalog() {
  return {
    version: STORE_VERSION,
    importedAt: null,
    source: null,
    products: {},
    suppliers: {},
    offers: {},
    pushQueue: {}
  };
}

function assertSafeId(id, label = 'id') {
  const value = String(id || '');
  if (!/^[a-zA-Z0-9_.:@-]+$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

class FileCatalogStore {
  constructor(directory) {
    this.directory = directory;
    this.catalogPath = path.join(directory, 'catalog.json');
    this.decisionDir = path.join(directory, 'decisions');
    this.decisionLogPath = path.join(directory, 'decision-log.jsonl');
    this.idempotencyPath = path.join(directory, 'idempotency-index.json');
  }

  ensureDirectory() {
    fs.mkdirSync(this.directory, { recursive: true });
    fs.mkdirSync(this.decisionDir, { recursive: true });
  }

  loadCatalog() {
    this.ensureDirectory();
    if (!fs.existsSync(this.catalogPath)) return emptyCatalog();
    const parsed = JSON.parse(fs.readFileSync(this.catalogPath, 'utf8'));
    return {
      ...emptyCatalog(),
      ...parsed,
      products: parsed.products || {},
      suppliers: parsed.suppliers || {},
      offers: parsed.offers || {},
      pushQueue: parsed.pushQueue || {}
    };
  }

  saveCatalog(catalog) {
    this.ensureDirectory();
    fs.writeFileSync(this.catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  }

  importDatasets(datasets, source, now = new Date()) {
    const catalog = this.loadCatalog();
    const stats = {};

    const mappings = [
      ['product_sourcing_pipeline', 'products'],
      ['supplier_vendor_dataset', 'suppliers'],
      ['supplier_offer_rates', 'offers'],
      ['shopify_product_push_queue', 'pushQueue']
    ];

    for (const [datasetName, collectionName] of mappings) {
      const rows = Array.isArray(datasets[datasetName]) ? datasets[datasetName] : [];
      let upserted = 0;

      for (const row of rows) {
        if (!row.id) continue;
        catalog[collectionName][row.id] = cloneJson(row);
        upserted += 1;
      }

      stats[datasetName] = {
        collection: collectionName,
        upserted
      };
    }

    catalog.importedAt = now.toISOString();
    catalog.source = source || null;
    catalog.contentHash = sha256({
      products: catalog.products,
      suppliers: catalog.suppliers,
      offers: catalog.offers,
      pushQueue: catalog.pushQueue
    });
    this.saveCatalog(catalog);

    return {
      importedAt: catalog.importedAt,
      source: catalog.source,
      contentHash: catalog.contentHash,
      stats
    };
  }

  list(collectionName, { limit = 100, offset = 0 } = {}) {
    if (!COLLECTIONS.includes(collectionName)) throw new Error(`Unknown collection: ${collectionName}`);
    const catalog = this.loadCatalog();
    const rows = Object.values(catalog[collectionName]);
    return {
      total: rows.length,
      limit,
      offset,
      items: rows.slice(offset, offset + limit)
    };
  }

  get(collectionName, id) {
    if (!COLLECTIONS.includes(collectionName)) throw new Error(`Unknown collection: ${collectionName}`);
    const catalog = this.loadCatalog();
    return catalog[collectionName][id] || null;
  }

  put(collectionName, row) {
    if (!COLLECTIONS.includes(collectionName)) throw new Error(`Unknown collection: ${collectionName}`);
    if (!row || typeof row !== 'object' || !row.id) throw new TypeError('Catalog row must include an id.');

    const catalog = this.loadCatalog();
    catalog[collectionName][row.id] = cloneJson(row);
    catalog.importedAt = new Date().toISOString();
    catalog.contentHash = sha256({
      products: catalog.products,
      suppliers: catalog.suppliers,
      offers: catalog.offers,
      pushQueue: catalog.pushQueue
    });
    this.saveCatalog(catalog);
    return catalog[collectionName][row.id];
  }

  saveDecision(record) {
    if (!record || typeof record !== 'object' || !record.id) {
      throw new TypeError('Decision record must include an id.');
    }

    this.ensureDirectory();
    const safeId = assertSafeId(record.id, 'decision id');
    const filePath = path.join(this.decisionDir, `${safeId}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    fs.appendFileSync(this.decisionLogPath, `${JSON.stringify(record)}\n`, 'utf8');
    return filePath;
  }

  getDecision(id) {
    this.ensureDirectory();
    const filePath = path.join(this.decisionDir, `${assertSafeId(id, 'decision id')}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  loadIdempotencyIndex() {
    this.ensureDirectory();
    if (!fs.existsSync(this.idempotencyPath)) return {};
    return JSON.parse(fs.readFileSync(this.idempotencyPath, 'utf8'));
  }

  getIdempotentDecision(key) {
    if (!key) return null;
    const index = this.loadIdempotencyIndex();
    const decisionId = index[String(key)];
    return decisionId ? this.getDecision(decisionId) : null;
  }

  saveIdempotencyKey(key, decisionId) {
    if (!key) return;
    const index = this.loadIdempotencyIndex();
    index[String(key)] = decisionId;
    fs.writeFileSync(this.idempotencyPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  }
}

module.exports = {
  FileCatalogStore,
  STORE_VERSION
};
