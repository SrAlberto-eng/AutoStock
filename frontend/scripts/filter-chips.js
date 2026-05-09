/**
 * filter-chips.js
 * Utilidad compartida para chips de filtros en modo single o multi-select.
 */

function setChipState(chip, isActive) {
  if (!chip) return;
  chip.classList.toggle('active', !!isActive);
  chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
}

function initFilterChips(options = {}) {
  const chipSelector                = options.chipSelector || '.filter-chip';
  const mode                        = options.mode === 'multi' ? 'multi' : 'single';
  const datasetKey                  = options.datasetKey || 'status';
  const allValue                    = options.allValue !== undefined ? String(options.allValue) : '';
  const normalizeAllWhenAllSelected = options.normalizeAllWhenAllSelected !== false;
  const onChange                    = typeof options.onChange === 'function' ? options.onChange : () => {};

  const chips = Array.from(document.querySelectorAll(chipSelector));
  if (!chips.length) return { chips: [], getSelectedValues: () => [] };

  const allChip    = chips.find(chip => String(chip.dataset[datasetKey] || '') === allValue) || null;
  const nonAllChips = chips.filter(chip => chip !== allChip);

  function getSelectedValues() {
    if (mode === 'single') {
      const activeChip = chips.find(chip => chip.classList.contains('active')) || null;
      if (!activeChip) return [];
      const activeValue = String(activeChip.dataset[datasetKey] || '');
      return activeValue === allValue ? [] : [activeValue];
    }
    return nonAllChips
      .filter(chip => chip.classList.contains('active'))
      .map(chip => String(chip.dataset[datasetKey] || ''));
  }

  function activateAll() {
    if (allChip) setChipState(allChip, true);
    nonAllChips.forEach(chip => setChipState(chip, false));
  }

  function ensureValidInitialState() {
    if (!allChip) return;
    if (mode === 'single') {
      const activeCount = chips.filter(chip => chip.classList.contains('active')).length;
      if (activeCount !== 1) activateAll();
      return;
    }
    const activeNonAll = nonAllChips.filter(chip => chip.classList.contains('active'));
    if (allChip.classList.contains('active') && activeNonAll.length > 0) setChipState(allChip, false);
    if (!allChip.classList.contains('active') && activeNonAll.length === 0) setChipState(allChip, true);
  }

  chips.forEach(chip => {
    chip.addEventListener('click', e => {
      e.preventDefault();

      if (mode === 'single') {
        chips.forEach(item => setChipState(item, false));
        setChipState(chip, true);
        onChange(getSelectedValues());
        return;
      }

      if (chip === allChip) {
        activateAll();
        onChange(getSelectedValues());
        return;
      }

      if (chip.classList.contains('active')) {
        setChipState(chip, false);
        const hasActive = nonAllChips.some(item => item.classList.contains('active'));
        if (!hasActive && allChip) setChipState(allChip, true);
        onChange(getSelectedValues());
        return;
      }

      setChipState(chip, true);
      if (allChip) setChipState(allChip, false);

      if (normalizeAllWhenAllSelected) {
        const allSelected = nonAllChips.length > 0 && nonAllChips.every(item => item.classList.contains('active'));
        if (allSelected) activateAll();
      }

      onChange(getSelectedValues());
    });
  });

  ensureValidInitialState();

  return { chips, getSelectedValues, allChip, nonAllChips };
}

export { initFilterChips };
