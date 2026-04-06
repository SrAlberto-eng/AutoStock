/**
 * filter-chips.js
 * Utilidad compartida para chips de filtros en modo single o multi-select.
 */

(function () {
  'use strict';

  function setChipState(chip, isActive) {
    if (!chip) return;
    chip.classList.toggle('active', !!isActive);
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }

  function initFilterChips(options) {
    var opts = options || {};
    var chipSelector = opts.chipSelector || '.filter-chip';
    var mode = opts.mode === 'multi' ? 'multi' : 'single';
    var datasetKey = opts.datasetKey || 'status';
    var allValue = opts.allValue !== undefined ? String(opts.allValue) : '';
    var normalizeAllWhenAllSelected = opts.normalizeAllWhenAllSelected !== false;
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};

    var chips = Array.from(document.querySelectorAll(chipSelector));
    if (!chips.length) {
      return {
        chips: [],
        getSelectedValues: function () { return []; }
      };
    }

    var allChip = chips.find(function (chip) {
      return String(chip.dataset[datasetKey] || '') === allValue;
    }) || null;

    var nonAllChips = chips.filter(function (chip) { return chip !== allChip; });

    function getSelectedValues() {
      if (mode === 'single') {
        var activeChip = chips.find(function (chip) { return chip.classList.contains('active'); }) || null;
        if (!activeChip) return [];
        var activeValue = String(activeChip.dataset[datasetKey] || '');
        return activeValue === allValue ? [] : [activeValue];
      }

      return nonAllChips
        .filter(function (chip) { return chip.classList.contains('active'); })
        .map(function (chip) { return String(chip.dataset[datasetKey] || ''); });
    }

    function emitChange() {
      onChange(getSelectedValues());
    }

    function activateAll() {
      if (allChip) setChipState(allChip, true);
      nonAllChips.forEach(function (chip) { setChipState(chip, false); });
    }

    function ensureValidInitialState() {
      if (!allChip) return;

      if (mode === 'single') {
        var activeCount = chips.filter(function (chip) { return chip.classList.contains('active'); }).length;
        if (activeCount !== 1) activateAll();
        return;
      }

      var activeNonAll = nonAllChips.filter(function (chip) { return chip.classList.contains('active'); });
      if (allChip.classList.contains('active') && activeNonAll.length > 0) {
        setChipState(allChip, false);
      }
      if (!allChip.classList.contains('active') && activeNonAll.length === 0) {
        setChipState(allChip, true);
      }
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.preventDefault();

        if (mode === 'single') {
          chips.forEach(function (item) { setChipState(item, false); });
          setChipState(chip, true);
          emitChange();
          return;
        }

        if (chip === allChip) {
          activateAll();
          emitChange();
          return;
        }

        if (chip.classList.contains('active')) {
          setChipState(chip, false);
          var hasActive = nonAllChips.some(function (item) { return item.classList.contains('active'); });
          if (!hasActive && allChip) setChipState(allChip, true);
          emitChange();
          return;
        }

        setChipState(chip, true);
        if (allChip) setChipState(allChip, false);

        if (normalizeAllWhenAllSelected) {
          var allSelected = nonAllChips.length > 0 && nonAllChips.every(function (item) {
            return item.classList.contains('active');
          });
          if (allSelected) activateAll();
        }

        emitChange();
      });
    });

    ensureValidInitialState();

    return {
      chips: chips,
      getSelectedValues: getSelectedValues,
      allChip: allChip,
      nonAllChips: nonAllChips
    };
  }

  window.initFilterChips = initFilterChips;
})();
