const catalogTools = () => {
  document.querySelectorAll('[data-aidlyst-catalog-filters]').forEach((filterBar) => {
    if (filterBar.dataset.aidlystCatalogBound === 'true') return;
    filterBar.dataset.aidlystCatalogBound = 'true';

    const section = filterBar.closest('results-list') || document;
    const status = section.querySelector('[data-aidlyst-catalog-status]');
    const chips = Array.from(filterBar.querySelectorAll('[data-aidlyst-filter]'));
    const state = {
      type: '',
      sale: '',
      supplier: '',
    };

    const getItems = () => Array.from(section.querySelectorAll('.product-grid__item[data-aidlyst-product-type]'));

    const updateStatus = (visible, total) => {
      if (!status) return;
      const active = Object.values(state).filter(Boolean).length;
      if (!active) {
        status.textContent = '';
        return;
      }
      status.textContent = `${visible} of ${total} visible products match the selected filters.`;
    };

    const applyFilters = () => {
      const items = getItems();
      let visible = 0;

      items.forEach((item) => {
        const matchesType = !state.type || item.dataset.aidlystProductType === state.type;
        const matchesSale = !state.sale || item.dataset.aidlystSaleType === state.sale;
        const suppliers = ` ${item.dataset.aidlystSuppliers || ''} `;
        const matchesSupplier = !state.supplier || suppliers.includes(` ${state.supplier} `);
        const shouldShow = matchesType && matchesSale && matchesSupplier;

        item.hidden = !shouldShow;
        if (shouldShow) visible += 1;
      });

      updateStatus(visible, items.length);
    };

    const updateActiveChips = () => {
      chips.forEach((chip) => {
        const group = chip.dataset.aidlystFilter;
        const value = chip.dataset.aidlystFilterValue || '';
        const isAll = group === 'all';
        const isActive = isAll
          ? !state.type && !state.sale && !state.supplier
          : state[group] === value;

        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-pressed', String(isActive));
      });
    };

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const group = chip.dataset.aidlystFilter;
        const value = chip.dataset.aidlystFilterValue || '';

        if (group === 'all') {
          state.type = '';
          state.sale = '';
          state.supplier = '';
        } else if (state[group] === value) {
          state[group] = '';
        } else {
          state[group] = value;
        }

        updateActiveChips();
        applyFilters();
      });
    });

    updateActiveChips();
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', catalogTools, { once: true });
} else {
  catalogTools();
}

document.addEventListener('shopify:section:load', catalogTools);
