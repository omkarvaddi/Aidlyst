const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const debounce = (callback, wait = 220) => {
  let timeout;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), wait);
  };
};

const escapeHTML = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatMoney = (cents) => {
  const numeric = Number(cents);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Not listed';
  return moneyFormatter.format(numeric / 100);
};

const coerceJSON = (value, fallback) => {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const getHandleFromURL = (url) => {
  const parsed = new URL(url, window.location.origin);
  const parts = parsed.pathname.split('/').filter(Boolean);
  const productsIndex = parts.indexOf('products');
  return productsIndex >= 0 ? parts[productsIndex + 1] : parts.at(-1);
};

class AidlystComparisonTool extends HTMLElement {
  connectedCallback() {
    if (this.dataset.bound === 'true') return;
    this.dataset.bound = 'true';
    this.selectedProducts = [null, null];
    this.cache = new Map();
    this.body = this.querySelector('[data-aidlyst-compare-body]');

    this.querySelectorAll('[data-aidlyst-compare-close]').forEach((element) => {
      element.addEventListener('click', () => this.close());
    });

    this.querySelectorAll('[data-aidlyst-compare-search]').forEach((input) => {
      input.addEventListener(
        'input',
        debounce(() => this.searchProducts(input), 240)
      );
      input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) this.searchProducts(input);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.hidden) this.close();
    });
  }

  open() {
    this.hidden = false;
    document.documentElement.classList.add('aidlyst-comparison-open');
    this.querySelector('[data-aidlyst-compare-search="0"]')?.focus();
  }

  close() {
    this.hidden = true;
    document.documentElement.classList.remove('aidlyst-comparison-open');
  }

  async searchProducts(input) {
    const query = input.value.trim();
    const index = Number(input.dataset.aidlystCompareSearch);
    const results = this.querySelector(`[data-aidlyst-compare-results="${index}"]`);

    if (!results) return;
    if (query.length < 2) {
      results.innerHTML = '';
      return;
    }

    results.innerHTML = '<p class="aidlyst-comparison-tool__loading">Searching...</p>';

    try {
      const searchURL = `/search/suggest.json?q=${encodeURIComponent(
        query
      )}&resources[type]=product&resources[limit]=6`;
      const response = await fetch(searchURL);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      const products = data?.resources?.results?.products || [];
      this.renderResults(results, products, index);
    } catch (_error) {
      results.innerHTML = '<p class="aidlyst-comparison-tool__loading">Search is unavailable right now.</p>';
    }
  }

  renderResults(container, products, index) {
    if (!products.length) {
      container.innerHTML = '<p class="aidlyst-comparison-tool__loading">No matching products.</p>';
      return;
    }

    container.innerHTML = products
      .map((product) => {
        const image = product.image || product.featured_image?.url || '';
        return `
          <button type="button" class="aidlyst-comparison-tool__result" data-product-url="${escapeHTML(
            product.url
          )}">
            ${
              image
                ? `<img src="${escapeHTML(image)}" alt="" loading="lazy">`
                : '<span class="aidlyst-comparison-tool__result-placeholder"></span>'
            }
            <span>${escapeHTML(product.title)}</span>
          </button>
        `;
      })
      .join('');

    container.querySelectorAll('[data-product-url]').forEach((button) => {
      button.addEventListener('click', async () => {
        const productURL = button.dataset.productUrl;
        const title = button.textContent.trim();
        const searchInput = this.querySelector(`[data-aidlyst-compare-search="${index}"]`);
        if (searchInput) searchInput.value = title;
        container.innerHTML = '';

        this.selectedProducts[index] = await this.loadProduct(productURL, title);
        this.renderDashboard();
      });
    });
  }

  async loadProduct(productURL, fallbackTitle) {
    const handle = getHandleFromURL(productURL);
    if (this.cache.has(handle)) return this.cache.get(handle);

    const product = {
      handle,
      title: fallbackTitle || handle,
      url: new URL(productURL, window.location.origin).pathname,
      price: 0,
      compareAtPrice: 0,
      available: false,
      type: '',
      saleType: 'affiliate',
      suppliers: [],
      supplierCount: 0,
      priceHistory: [],
      supplierPriceSnapshot: [],
      reviewIntelligence: null,
      socialSignal: null,
    };

    try {
      const response = await fetch(`/products/${handle}.js`);
      if (response.ok) {
        const json = await response.json();
        product.title = json.title || product.title;
        product.price = json.price || 0;
        product.compareAtPrice = json.compare_at_price || 0;
        product.available = Boolean(json.available);
        product.type = json.type || '';
        product.image = json.featured_image || '';
      }
    } catch (_error) {
      // The HTML payload below still gives the dashboard useful metadata.
    }

    try {
      const htmlResponse = await fetch(product.url);
      if (htmlResponse.ok) {
        const html = await htmlResponse.text();
        const documentFragment = new DOMParser().parseFromString(html, 'text/html');
        const intelScript = documentFragment.querySelector('script[data-aidlyst-product-intel]');
        if (intelScript?.textContent) {
          const intel = JSON.parse(intelScript.textContent);
          product.saleType = intel.sale_type || product.saleType;
          product.suppliers = Array.isArray(intel.suppliers) ? intel.suppliers : [];
          product.supplierCount = Number(intel.supplier_count || product.suppliers.length || 0);
          product.priceHistory = coerceJSON(intel.price_history, []);
          product.supplierPriceSnapshot = coerceJSON(intel.supplier_price_snapshot, []);
          product.reviewIntelligence = coerceJSON(intel.review_intelligence, intel.review_intelligence || null);
          product.socialSignal = coerceJSON(intel.social_signal, intel.social_signal || null);
        }
      }
    } catch (_error) {
      // Keep the dashboard functional with standard product JSON.
    }

    this.cache.set(handle, product);
    return product;
  }

  getScore(product) {
    if (!product) return 0;
    let score = 42;
    score += Math.min(product.supplierCount, 5) * 8;
    if (product.available) score += 10;
    if (product.price > 0) score += 8;
    if (product.compareAtPrice > product.price) score += 6;
    if (product.priceHistory.length) score += 8;
    if (product.reviewIntelligence) score += 8;
    if (product.saleType === 'provider_required') score -= 8;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  renderDashboard() {
    const [first, second] = this.selectedProducts;
    const products = [first, second].filter(Boolean);

    if (!products.length) return;

    this.body.innerHTML = `
      <div class="aidlyst-comparison-tool__dashboard">
        <div class="aidlyst-comparison-tool__product-grid">
          ${[first, second].map((product, index) => this.renderProductPanel(product, index)).join('')}
        </div>
        ${this.renderStats(products)}
        ${this.renderPriceHistory(products)}
        ${this.renderReviewIntel(products)}
      </div>
    `;
  }

  renderProductPanel(product, index) {
    if (!product) {
      return `
        <article class="aidlyst-comparison-tool__product-panel aidlyst-comparison-tool__product-panel--empty">
          <span>Product ${index + 1}</span>
          <p>Select a product to complete the comparison.</p>
        </article>
      `;
    }

    const score = this.getScore(product);
    const saleLabel = {
      direct: 'Shop Direct',
      affiliate: 'Partner Product',
      provider_required: 'Provider Guidance',
    }[product.saleType] || 'Partner Product';

    return `
      <article class="aidlyst-comparison-tool__product-panel">
        <div class="aidlyst-comparison-tool__product-heading">
          ${product.image ? `<img src="${escapeHTML(product.image)}" alt="" loading="lazy">` : ''}
          <div>
            <h3>${escapeHTML(product.title)}</h3>
            <p>${escapeHTML(product.type || 'Product')}</p>
          </div>
        </div>
        <dl>
          <div><dt>Current price</dt><dd>${formatMoney(product.price)}</dd></div>
          <div><dt>Purchase path</dt><dd>${escapeHTML(saleLabel)}</dd></div>
          <div><dt>Supplier coverage</dt><dd>${product.supplierCount || 0}</dd></div>
          <div><dt>Purchase score</dt><dd>${score}%</dd></div>
        </dl>
        <a href="${escapeHTML(product.url)}">View product</a>
      </article>
    `;
  }

  renderStats(products) {
    const bestScore = products.reduce((best, product) => (this.getScore(product) > this.getScore(best) ? product : best));
    const bestCoverage = products.reduce((best, product) =>
      (product.supplierCount || 0) > (best.supplierCount || 0) ? product : best
    );
    const lowestPrice = products
      .filter((product) => product.price > 0)
      .reduce((best, product) => (!best || product.price < best.price ? product : best), null);

    return `
      <div class="aidlyst-comparison-tool__stats">
        <div><span>Best score</span><strong>${escapeHTML(bestScore?.title || 'N/A')}</strong></div>
        <div><span>Lowest listed price</span><strong>${lowestPrice ? escapeHTML(lowestPrice.title) : 'N/A'}</strong></div>
        <div><span>Supplier depth</span><strong>${escapeHTML(bestCoverage?.title || 'N/A')}</strong></div>
      </div>
    `;
  }

  renderPriceHistory(products) {
    const series = products
      .map((product) => ({
        title: product.title,
        points: product.priceHistory
          .map((point) => ({
            date: point.date || point.updated_at || point.timestamp || '',
            price: Number(point.price ?? point.amount ?? point.value),
          }))
          .filter((point) => point.date && Number.isFinite(point.price) && point.price > 0)
          .sort((a, b) => new Date(a.date) - new Date(b.date)),
      }))
      .filter((item) => item.points.length > 1);

    if (!series.length) {
      return `
        <section class="aidlyst-comparison-tool__chart-card">
          <h3>Price history</h3>
          <p>Add <code>custom.price_history_json</code> to products to show a price trend chart here.</p>
        </section>
      `;
    }

    const allPrices = series.flatMap((item) => item.points.map((point) => point.price));
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const width = 640;
    const height = 220;
    const pad = 28;
    const colors = ['#1f6feb', '#0f8f72'];

    const lines = series
      .map((item, seriesIndex) => {
        const points = item.points
          .map((point, index) => {
            const x = pad + (index / Math.max(item.points.length - 1, 1)) * (width - pad * 2);
            const spread = Math.max(max - min, 1);
            const y = height - pad - ((point.price - min) / spread) * (height - pad * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');

        return `<polyline points="${points}" fill="none" stroke="${colors[seriesIndex % colors.length]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`;
      })
      .join('');

    const legend = series
      .map(
        (item, index) =>
          `<span><i style="background:${colors[index % colors.length]}"></i>${escapeHTML(item.title)}</span>`
      )
      .join('');

    return `
      <section class="aidlyst-comparison-tool__chart-card">
        <div class="aidlyst-comparison-tool__chart-header">
          <h3>Price history</h3>
          <p>${formatMoney(min)} low / ${formatMoney(max)} high</p>
        </div>
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Price history chart">
          <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" />
          <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" />
          ${lines}
        </svg>
        <div class="aidlyst-comparison-tool__legend">${legend}</div>
      </section>
    `;
  }

  renderReviewIntel(products) {
    return `
      <section class="aidlyst-comparison-tool__intel">
        <h3>Review intelligence</h3>
        <div class="aidlyst-comparison-tool__intel-grid">
          ${products.map((product) => this.renderIntelCard(product)).join('')}
        </div>
      </section>
    `;
  }

  renderIntelCard(product) {
    const intel = product.reviewIntelligence;
    const social = product.socialSignal;

    if (!intel && !social) {
      return `
        <article>
          <h4>${escapeHTML(product.title)}</h4>
          <p>No cached review intelligence yet. Add <code>custom.review_intelligence_json</code> after running a low-cost local summary workflow.</p>
        </article>
      `;
    }

    const summary = typeof intel === 'string' ? intel : intel?.summary || intel?.overview || '';
    const pros = Array.isArray(intel?.pros) ? intel.pros : [];
    const cons = Array.isArray(intel?.cons) ? intel.cons : [];
    const confidence = intel?.confidence || social?.confidence || 'not scored';
    const sourceCount = intel?.source_count || social?.source_count || 0;

    return `
      <article>
        <h4>${escapeHTML(product.title)}</h4>
        ${summary ? `<p>${escapeHTML(summary)}</p>` : ''}
        <div class="aidlyst-comparison-tool__intel-lists">
          ${pros.length ? `<div><span>Pros</span><ul>${pros.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul></div>` : ''}
          ${cons.length ? `<div><span>Watch-outs</span><ul>${cons.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul></div>` : ''}
        </div>
        <footer>${escapeHTML(confidence)} confidence · ${Number(sourceCount) || 0} sources</footer>
      </article>
    `;
  }
}

if (!customElements.get('aidlyst-comparison-tool')) {
  customElements.define('aidlyst-comparison-tool', AidlystComparisonTool);
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-aidlyst-compare-open]');
  if (!trigger) return;

  event.preventDefault();
  document.querySelector('aidlyst-comparison-tool')?.open();
});
