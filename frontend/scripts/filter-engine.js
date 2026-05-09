/**
 * filter-engine.js
 * Motor compartido para filtros por tabla/lista en vistas.
 */

class FilterEngine {
  constructor(config = {}) {
    this.root          = config.root        || document;
    this.rowSelector   = config.rowSelector || '';
    this.getCriteria   = typeof config.getCriteria   === 'function' ? config.getCriteria   : () => ({});
    this.mapRow        = typeof config.mapRow        === 'function' ? config.mapRow        : row => row.dataset || {};
    this.predicates    = Array.isArray(config.predicates) ? config.predicates : [];
    this.setEmptyState = typeof config.setEmptyState === 'function' ? config.setEmptyState : null;
    this.onAfterApply  = typeof config.onAfterApply  === 'function' ? config.onAfterApply  : null;
  }

  queryRows() {
    if (!this.rowSelector) return [];
    return Array.from(this.root.querySelectorAll(this.rowSelector));
  }

  bindTriggers(triggers) {
    (triggers || []).forEach(trigger => {
      const selector  = typeof trigger === 'string' ? trigger : trigger.selector;
      const eventName = typeof trigger === 'object' && trigger.event ? trigger.event : 'change';
      if (!selector) return;
      this.root.querySelectorAll(selector).forEach(el => {
        el.addEventListener(eventName, () => this.apply());
      });
    });
  }

  apply() {
    const criteria = this.getCriteria();
    const rows     = this.queryRows();
    let visible    = 0;

    rows.forEach(row => {
      const rowData = this.mapRow(row, criteria) || {};
      const show    = this.predicates.every(predicate => predicate(criteria, rowData, row));
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    const result = { visible, total: rows.length, rows, criteria };
    if (this.setEmptyState) this.setEmptyState(result);
    if (this.onAfterApply)  this.onAfterApply(result);

    return { visible, total: rows.length };
  }
}

export { FilterEngine };
