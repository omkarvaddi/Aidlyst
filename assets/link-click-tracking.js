const STORAGE_KEY = 'aidlystLinkClickLog';
const MAX_STORED_EVENTS = 50;

function getLinkType(link, url) {
  if (link.dataset.aidlystLinkType) return link.dataset.aidlystLinkType;
  if (url.protocol === 'mailto:') return 'email';
  if (url.protocol === 'tel:') return 'phone';
  if (url.origin !== window.location.origin) return 'outbound';
  if (/\.(pdf|zip|csv|xlsx?|docx?)$/i.test(url.pathname)) return 'download';
  return 'internal';
}

function getLinkText(link) {
  const text = link.innerText || link.textContent || link.getAttribute('aria-label') || '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 140);
}

function getProductContext(link) {
  const productContainer = link.closest('[data-product-id], product-card, supplier-comparison-handler, supplier-link-handler');

  return {
    product_id:
      link.dataset.aidlystProductId ||
      productContainer?.dataset.productId ||
      productContainer?.getAttribute('data-product-id') ||
      '',
    product_title: link.dataset.aidlystProductTitle || productContainer?.dataset.productTitle || '',
  };
}

function persistDebugEvent(payload) {
  try {
    const current = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    current.unshift({
      ...payload,
      tracked_at: new Date().toISOString(),
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(0, MAX_STORED_EVENTS)));
  } catch (error) {
    // Tracking must never block navigation.
  }
}

function publishToAnalytics(eventName, payload) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    ...payload,
  });

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, payload);
  }

  try {
    if (window.Shopify?.analytics?.publish) {
      window.Shopify.analytics.publish(eventName, payload);
    }
  } catch (error) {
    // Some Shopify analytics contexts are sandboxed; ignore publish failures.
  }
}

function buildPayload(link) {
  const url = new URL(link.getAttribute('href'), window.location.origin);
  const product = getProductContext(link);

  return {
    link_url: url.href,
    link_text: getLinkText(link),
    link_id: link.id || '',
    link_classes: link.className || '',
    link_type: getLinkType(link, url),
    destination_host: url.host,
    current_path: window.location.pathname,
    current_url: window.location.href,
    supplier_name: link.dataset.aidlystSupplier || '',
    supplier_key: link.dataset.aidlystSupplierKey || '',
    supplier_namespace: link.dataset.aidlystSupplierNamespace || '',
    product_id: product.product_id,
    product_title: product.product_title,
  };
}

function trackLink(link) {
  if (!link?.hasAttribute('href')) return null;

  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;

  let payload;
  try {
    payload = buildPayload(link);
  } catch (error) {
    return null;
  }

  publishToAnalytics('aidlyst_link_click', payload);

  if (payload.link_type === 'supplier') {
    publishToAnalytics('aidlyst_supplier_click', payload);
  }

  document.dispatchEvent(
    new CustomEvent('aidlyst:link-click', {
      detail: payload,
    })
  );
  persistDebugEvent(payload);

  return payload;
}

document.addEventListener(
  'click',
  (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;

    trackLink(link);
  },
  { capture: true }
);

window.AidlystLinkTracker = {
  trackLink,
  getStoredEvents() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (error) {
      return [];
    }
  },
  clearStoredEvents() {
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
