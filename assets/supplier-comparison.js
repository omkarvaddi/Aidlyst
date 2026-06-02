class SupplierComparisonHandler extends HTMLElement {
  connectedCallback() {
    this.productId = this.dataset.productId || '';
    this.productTitle = this.dataset.productTitle || '';
    this.suppliers = this.readSuppliers();
    this.cacheComparisonData();
    this.bindSupplierEvents();
  }

  readSuppliers() {
    return Array.from(this.querySelectorAll('[data-aidlyst-link-type="supplier"]')).map((link) => ({
      name: link.dataset.aidlystSupplier || link.dataset.supplierName || link.textContent.trim(),
      key: link.dataset.aidlystSupplierKey || link.dataset.supplierKey || '',
      namespace: link.dataset.aidlystSupplierNamespace || '',
      url: link.href,
      element: link,
    }));
  }

  cacheComparisonData() {
    const comparisonData = {
      productId: this.productId,
      productTitle: this.productTitle,
      supplierCount: this.suppliers.length,
      suppliers: this.suppliers.map(({ name, key, namespace, url }) => ({
        name,
        key,
        namespace,
        url,
      })),
    };

    window.productComparison = window.productComparison || {};
    window.productComparison[this.productId] = comparisonData;

    document.dispatchEvent(
      new CustomEvent('supplier-comparison-ready', {
        detail: comparisonData,
      })
    );
  }

  bindSupplierEvents() {
    this.suppliers.forEach((supplier) => {
      if (!supplier.element || supplier.element.dataset.supplierComparisonBound === 'true') return;

      supplier.element.dataset.supplierComparisonBound = 'true';
      supplier.element.addEventListener('click', () => {
        this.dispatchSupplierClick(supplier);
      });
    });
  }

  dispatchSupplierClick(supplier) {
    document.dispatchEvent(
      new CustomEvent('supplier-clicked', {
        detail: {
          productId: this.productId,
          productTitle: this.productTitle,
          supplier: supplier.name,
          supplierKey: supplier.key,
          supplierNamespace: supplier.namespace,
          url: supplier.url,
          availableSuppliers: this.suppliers.length,
        },
      })
    );
  }

  getComparison() {
    return {
      productId: this.productId,
      productTitle: this.productTitle,
      suppliers: this.suppliers,
      count: this.suppliers.length,
    };
  }

  getCheapestSupplier() {
    return this.suppliers[0] || null;
  }
}

if (!customElements.get('supplier-comparison-handler')) {
  customElements.define('supplier-comparison-handler', SupplierComparisonHandler);
}

const SupplierComparisonUtil = {
  KNOWN_SUPPLIERS: {
    supplier_url: 'Supplier',
    amazon_url: 'Amazon',
    walmart_url: 'Walmart',
    target_url: 'Target',
    cvs_url: 'CVS',
    walgreens_url: 'Walgreens',
    best_buy_url: 'Best Buy',
    medline_url: 'Medline',
    ebay_url: 'eBay',
    costco_url: 'Costco',
    home_depot_url: 'Home Depot',
    wayfair_url: 'Wayfair',
  },

  getAvailableSuppliers(productId) {
    return this.getComparison(productId).suppliers || [];
  },

  getComparison(productId) {
    const cached = window.productComparison?.[productId];
    if (cached) return cached;

    const handler = document.querySelector(`supplier-comparison-handler[data-product-id="${productId}"]`);
    return handler?.getComparison?.() || { productId, suppliers: [], supplierCount: 0 };
  },

  hasMultipleSuppliers(productId) {
    return this.getAvailableSuppliers(productId).length > 1;
  },

  getSupplierName(key) {
    return this.KNOWN_SUPPLIERS[key] || key.replace(/_url$/, '').replace(/_/g, ' ');
  },

  getSupplierByName(productId, supplierName) {
    return (
      this.getAvailableSuppliers(productId).find(
        (supplier) => supplier.name.toLowerCase() === supplierName.toLowerCase()
      ) || null
    );
  },

  getMultiSupplierProducts() {
    return Array.from(document.querySelectorAll('supplier-comparison-handler'))
      .map((handler) => handler.getComparison?.())
      .filter((comparison) => comparison?.suppliers?.length > 1)
      .map((comparison) => ({
        productId: comparison.productId,
        supplierCount: comparison.suppliers.length,
        suppliers: comparison.suppliers.map((supplier) => supplier.name),
      }));
  },

  getPageStats() {
    const comparisons = Array.from(document.querySelectorAll('supplier-comparison-handler')).map((handler) =>
      handler.getComparison?.()
    );
    const stats = {
      totalProducts: comparisons.length,
      productsWithSuppliers: 0,
      totalSupplierLinks: 0,
      supplierBreakdown: {},
    };

    comparisons.forEach((comparison) => {
      if (!comparison?.suppliers?.length) return;

      stats.productsWithSuppliers += 1;
      stats.totalSupplierLinks += comparison.suppliers.length;

      comparison.suppliers.forEach((supplier) => {
        const key = supplier.key || supplier.name;
        stats.supplierBreakdown[key] = (stats.supplierBreakdown[key] || 0) + 1;
      });
    });

    return stats;
  },
};

window.SupplierComparisonUtil = SupplierComparisonUtil;
