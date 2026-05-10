/**
 * DateRangePicker
 * Componente de selección de rango de fechas con presets y rango personalizado.
 * Uso: new DateRangePicker({ containerId, onChange, initialFrom, initialTo })
 */
import { MSG } from './constants/messages.js';

const PRESETS = [
  { key: 'today',     label: () => MSG.REPORTS.DATE_TODAY },
  { key: 'yesterday', label: () => MSG.REPORTS.DATE_YESTERDAY },
  { key: 'last7',     label: () => MSG.REPORTS.DATE_LAST_7 },
  { key: 'last30',    label: () => MSG.REPORTS.DATE_LAST_30 },
  { key: 'thisMonth', label: () => MSG.REPORTS.DATE_THIS_MONTH },
  { key: 'lastMonth', label: () => MSG.REPORTS.DATE_LAST_MONTH },
];

/** Devuelve YYYY-MM-DD en hora local (evita desfase UTC). */
function toLocalISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calcPreset(key) {
  const today = new Date();
  switch (key) {
    case 'today':
      return { from: toLocalISO(today), to: toLocalISO(today) };
    case 'yesterday': {
      const d = new Date(today); d.setDate(d.getDate() - 1);
      return { from: toLocalISO(d), to: toLocalISO(d) };
    }
    case 'last7': {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      return { from: toLocalISO(d), to: toLocalISO(today) };
    }
    case 'last30': {
      const d = new Date(today); d.setDate(d.getDate() - 29);
      return { from: toLocalISO(d), to: toLocalISO(today) };
    }
    case 'thisMonth': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toLocalISO(from), to: toLocalISO(to) };
    }
    case 'lastMonth': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to   = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toLocalISO(from), to: toLocalISO(to) };
    }
    default:
      return { from: null, to: null };
  }
}

/**
 * Formatea YYYY-MM-DD como "09 may".
 * Construye las partes por separado para evitar que es-MX las una con guión.
 */
function fmtShort(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date  = new Date(y, m - 1, d);
  const day   = String(d).padStart(2, '0');
  const month = date.toLocaleDateString('es-MX', { month: 'short' }).replace(/\.$/, '');
  return `${day} ${month}`;
}

let DRP_INSTANCE_COUNTER = 0;

function buildHTML({ inputFromId, inputToId }) {
  const presetBtns = PRESETS.map(p =>
    `<button type="button" class="drp-preset-btn" data-preset="${p.key}">${p.label()}</button>`
  ).join('');

  return `
<div class="drp-wrapper">
  <div class="drp-trigger-wrap">
    <button type="button" class="drp-trigger" aria-haspopup="true" aria-expanded="false">
      <svg class="drp-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
      <span class="drp-label">${MSG.REPORTS.DATE_ALL}</span>
      <svg class="drp-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <button type="button" class="drp-clear hidden" aria-label="Limpiar rango de fechas">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <div class="drp-dropdown hidden" role="dialog" aria-label="Selector de rango de fechas">
    <p class="drp-section-title">${MSG.REPORTS.DATE_PRESETS_TITLE}</p>
    <div class="drp-preset-grid">${presetBtns}</div>

    <div class="drp-divider"></div>

    <p class="drp-section-title">${MSG.REPORTS.DATE_CUSTOM}</p>
    <div class="drp-inputs">
      <div class="drp-field">
        <label class="drp-field-label" for="${inputFromId}">${MSG.REPORTS.DATE_FROM}</label>
        <input type="date" id="${inputFromId}" class="input drp-input-from" aria-label="${MSG.REPORTS.DATE_FROM}">
      </div>
      <div class="drp-field">
        <label class="drp-field-label" for="${inputToId}">${MSG.REPORTS.DATE_TO}</label>
        <input type="date" id="${inputToId}" class="input drp-input-to" aria-label="${MSG.REPORTS.DATE_TO}">
      </div>
    </div>

    <div class="drp-actions">
      <button type="button" class="btn btn-outline btn-sm drp-btn-clear">${MSG.REPORTS.DATE_CLEAR}</button>
      <button type="button" class="btn btn-primary btn-sm drp-btn-apply">${MSG.REPORTS.DATE_APPLY}</button>
    </div>
  </div>
</div>`;
}

export class DateRangePicker {
  /**
   * @param {{ containerId: string, onChange: (v: {from: string|null, to: string|null}) => void, initialFrom?: string|null, initialTo?: string|null }} opts
   */
  constructor({ containerId, onChange, initialFrom = null, initialTo = null }) {
    this._from     = initialFrom || null;
    this._to       = initialTo   || null;
    this._onChange = onChange;
    this._open     = false;

    const container = document.getElementById(containerId);
    if (!container) return;
    this._container = container;
    this._inputFromId = `${containerId}-drp-input-from-${++DRP_INSTANCE_COUNTER}`;
    this._inputToId = `${containerId}-drp-input-to-${DRP_INSTANCE_COUNTER}`;

    container.innerHTML = buildHTML({ inputFromId: this._inputFromId, inputToId: this._inputToId });
    this._bindEvents();
    this._updateTriggerLabel();
    this._syncInputs();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getValue() { return { from: this._from, to: this._to }; }

  setValue(from, to) {
    this._from = from || null;
    this._to   = to   || null;
    this._syncInputs();
    this._updateTriggerLabel();
  }

  clear() {
    this._from = null;
    this._to   = null;
    this._syncInputs();
    this._updateTriggerLabel();
    this._onChange({ from: null, to: null });
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _q(sel)  { return this._container.querySelector(sel); }
  _qa(sel) { return this._container.querySelectorAll(sel); }

  _bindEvents() {
    const wrapper   = this._q('.drp-wrapper');
    const trigger   = this._q('.drp-trigger');
    const clearBtn  = this._q('.drp-clear');
    const inputFrom = this._q('.drp-input-from');
    const inputTo   = this._q('.drp-input-to');
    const btnClear  = this._q('.drp-btn-clear');
    const btnApply  = this._q('.drp-btn-apply');

    trigger.addEventListener('click', () => this._toggleDropdown());

    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clear();
    });

    this._qa('.drp-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const { from, to } = calcPreset(btn.dataset.preset);
        this._from = from;
        this._to   = to;
        this._syncInputs();
        this._updatePresetHighlight();
        this._closeDropdown();
        this._updateTriggerLabel();
        this._onChange({ from, to });
      });
    });

    inputFrom.addEventListener('change', () => {
      if (inputTo.value && inputFrom.value > inputTo.value) {
        inputTo.value = inputFrom.value;
      }
      inputTo.min = inputFrom.value || '';
    });

    btnApply.addEventListener('click', () => {
      let from = inputFrom.value || null;
      let to   = inputTo.value   || null;
      if (from && to && from > to) [from, to] = [to, from];
      this._from = from;
      this._to   = to;
      this._syncInputs();
      this._updatePresetHighlight();
      this._closeDropdown();
      this._updateTriggerLabel();
      this._onChange({ from: this._from, to: this._to });
    });

    btnClear.addEventListener('click', () => {
      this.clear();
      this._closeDropdown();
    });

    document.addEventListener('click', (e) => {
      if (this._open && !wrapper.contains(e.target)) this._closeDropdown();
    });

    document.addEventListener('keydown', (e) => {
      if (this._open && e.key === 'Escape') this._closeDropdown();
    });
  }

  _toggleDropdown() {
    this._open ? this._closeDropdown() : this._openDropdown();
  }

  _openDropdown() {
    this._q('.drp-dropdown').classList.remove('hidden');
    this._q('.drp-trigger').setAttribute('aria-expanded', 'true');
    this._q('.drp-trigger-wrap').classList.add('open');
    this._open = true;
    this._syncInputs();
    this._updatePresetHighlight();
  }

  _closeDropdown() {
    this._q('.drp-dropdown').classList.add('hidden');
    this._q('.drp-trigger').setAttribute('aria-expanded', 'false');
    this._q('.drp-trigger-wrap').classList.remove('open');
    this._open = false;
  }

  _syncInputs() {
    const inputFrom = this._q('.drp-input-from');
    const inputTo   = this._q('.drp-input-to');
    if (!inputFrom || !inputTo) return;
    inputFrom.value = this._from || '';
    inputTo.value   = this._to   || '';
    inputTo.min     = this._from || '';
  }

  _updateTriggerLabel() {
    const label      = this._q('.drp-label');
    const clearBtn   = this._q('.drp-clear');
    const triggerWrap = this._q('.drp-trigger-wrap');

    if (!this._from && !this._to) {
      label.textContent = MSG.REPORTS.DATE_ALL;
      clearBtn.classList.add('hidden');
      triggerWrap.classList.remove('has-value');
      return;
    }

    if (this._from && this._to && this._from === this._to) {
      label.textContent = fmtShort(this._from);
    } else if (this._from && this._to) {
      label.textContent = `${fmtShort(this._from)} — ${fmtShort(this._to)}`;
    } else if (this._from) {
      label.textContent = `${MSG.REPORTS.DATE_FROM} ${fmtShort(this._from)}`;
    } else {
      label.textContent = `${MSG.REPORTS.DATE_TO} ${fmtShort(this._to)}`;
    }

    clearBtn.classList.remove('hidden');
    triggerWrap.classList.add('has-value');
  }

  _updatePresetHighlight() {
    this._qa('.drp-preset-btn').forEach(btn => {
      const { from, to } = calcPreset(btn.dataset.preset);
      btn.classList.toggle('active', from === this._from && to === this._to);
    });
  }
}
