/**
 * filter-engine.js
 * Motor compartido para filtros por tabla/lista en vistas.
 * Cada vista define su adaptador (criterios, mapeo de fila y predicados).
 */

(function () {
  'use strict';

  function FilterEngine(config) {
    var cfg = config || {};
    this.root = cfg.root || document;
    this.rowSelector = cfg.rowSelector || '';
    this.getCriteria = typeof cfg.getCriteria === 'function' ? cfg.getCriteria : function () { return {}; };
    this.mapRow = typeof cfg.mapRow === 'function' ? cfg.mapRow : function (row) { return row.dataset || {}; };
    this.predicates = Array.isArray(cfg.predicates) ? cfg.predicates : [];
    this.setEmptyState = typeof cfg.setEmptyState === 'function' ? cfg.setEmptyState : null;
    this.onAfterApply = typeof cfg.onAfterApply === 'function' ? cfg.onAfterApply : null;
  }

  FilterEngine.prototype.queryRows = function () {
    if (!this.rowSelector) return [];
    return Array.from(this.root.querySelectorAll(this.rowSelector));
  };

  FilterEngine.prototype.bindTriggers = function (triggers) {
    var self = this;
    (triggers || []).forEach(function (trigger) {
      var selector = typeof trigger === 'string' ? trigger : trigger.selector;
      var eventName = (typeof trigger === 'object' && trigger.event) ? trigger.event : 'change';
      if (!selector) return;

      self.root.querySelectorAll(selector).forEach(function (el) {
        el.addEventListener(eventName, function () {
          self.apply();
        });
      });
    });
  };

  FilterEngine.prototype.apply = function () {
    var criteria = this.getCriteria();
    var rows = this.queryRows();
    var visible = 0;

    rows.forEach(function (row) {
      var rowData = this.mapRow(row, criteria) || {};
      var show = this.predicates.every(function (predicate) {
        return predicate(criteria, rowData, row);
      });

      row.style.display = show ? '' : 'none';
      if (show) visible++;
    }, this);

    if (this.setEmptyState) {
      this.setEmptyState({
        visible: visible,
        total: rows.length,
        rows: rows,
        criteria: criteria,
      });
    }

    if (this.onAfterApply) {
      this.onAfterApply({
        visible: visible,
        total: rows.length,
        rows: rows,
        criteria: criteria,
      });
    }

    return { visible: visible, total: rows.length };
  };

  window.FilterEngine = FilterEngine;
})();
