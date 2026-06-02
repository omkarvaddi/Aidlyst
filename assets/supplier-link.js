class SupplierLinkHandler extends HTMLElement {
  connectedCallback() {
    this.productId = this.dataset.productId || '';
    this.productTitle = this.dataset.productTitle || '';
    this.supplierName = this.dataset.supplierName || 'Supplier';
    this.supplierUrl = this.dataset.supplierUrl || this.querySelector('[data-testid="supplier-link"]')?.href || '';
    this.bindClickEvent();
  }

  bindClickEvent() {
    const link = this.querySelector('[data-testid="supplier-link"]');
    if (!link || link.dataset.supplierLinkBound === 'true') return;

    link.dataset.supplierLinkBound = 'true';
    link.addEventListener('click', () => {
      document.dispatchEvent(
        new CustomEvent('supplier-link-click', {
          detail: {
            productId: this.productId,
            productTitle: this.productTitle,
            supplier: this.supplierName,
            url: this.supplierUrl || link.href,
          },
        })
      );
    });
  }
}

if (!customElements.get('supplier-link-handler')) {
  customElements.define('supplier-link-handler', SupplierLinkHandler);
}

window.SupplierLinkUtil = {
  getSupplierLinks() {
    return Array.from(document.querySelectorAll('[data-aidlyst-link-type="supplier"]')).map((link) => ({
      productId: link.dataset.aidlystProductId || '',
      productTitle: link.dataset.aidlystProductTitle || '',
      supplier: link.dataset.aidlystSupplier || 'Supplier',
      url: link.href,
    }));
  },

  isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;

    try {
      new URL(url, window.location.origin);
      return true;
    } catch (error) {
      return false;
    }
  },
};
