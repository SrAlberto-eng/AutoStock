/**
 * reportes.js
 * Historial de movimientos con filtros por tipo (chips), texto y fechas.
 * Exportación a CSV con BOM para compatibilidad Excel.
 */
import { MSG }                           from './constants/messages.js';
import { formatDateTime, toDateOnly }    from './utils.js';
import { tipoBadge }                     from './ui-helpers.js';

const REPORTES_VIEW_NAME = 'reportes';

let reportTypeChipController = null;
/** Todos los movimientos cargados desde el backend. */
let reportItems = [];
/** Subconjunto visible tras aplicar el filtro de texto. */
let reportItemsVisible = [];

// ── Persistencia de filtros ───────────────────────────────────────────────

function saveUIState() {
  if (typeof window.storageManager?.saveUIState !== 'function') return;
  const selectedTypes = getSelectedTypes();
  window.storageManager.saveUIState(REPORTES_VIEW_NAME, {
    tipos:        selectedTypes.join(','),
    fecha_desde:  document.getElementById('date-from')?.value || '',
    fecha_hasta:  document.getElementById('date-to')?.value   || '',
  });
}

function restoreUIState() {
  if (typeof window.storageManager?.loadUIState !== 'function') return null;
  const saved = window.storageManager.loadUIState(REPORTES_VIEW_NAME);
  if (!saved) return null;
  const dateFrom = document.getElementById('date-from');
  const dateTo   = document.getElementById('date-to');
  if (dateFrom && saved.fecha_desde != null) dateFrom.value = String(saved.fecha_desde);
  if (dateTo   && saved.fecha_hasta != null) dateTo.value   = String(saved.fecha_hasta);
  return saved;
}

/** Restaura el estado activo de los chips de tipo guardados. */
function restoreTypeChips(savedTipos) {
  if (!savedTipos) return;
  const wanted = String(savedTipos).split(',').map(v => v.trim()).filter(Boolean);
  if (!wanted.length) return;

  const chips  = Array.from(document.querySelectorAll('.filter-chip[data-type]'));
  const allChip = chips.find(c => (c.dataset.type || '') === '');

  chips.forEach(chip => {
    const isActive = wanted.includes(chip.dataset.type || '');
    chip.classList.toggle('active', isActive);
    chip.setAttribute('aria-pressed', String(isActive));
  });
  allChip?.classList.toggle('active', false);
  allChip?.setAttribute('aria-pressed', 'false');
}

// ── Filtros activos ───────────────────────────────────────────────────────

function getSelectedTypes() {
  if (reportTypeChipController) return reportTypeChipController.getSelectedValues();
  return Array.from(document.querySelectorAll('.filter-chip.active'))
    .map(c => c.dataset.type)
    .filter(t => t !== '');
}

/** Construye el objeto de filtros para la llamada al backend. */
function getActiveFilters() {
  const dateFrom = document.getElementById('date-from');
  const dateTo   = document.getElementById('date-to');
  const types    = getSelectedTypes();

  const filters = { skip: 0, limit: 50 };
  if (dateFrom?.value) filters.fecha_desde = dateFrom.value;
  if (dateTo?.value)   filters.fecha_hasta  = dateTo.value;
  if (types.length === 1) filters.tipo  = types[0];
  if (types.length > 1)  filters.tipos = types.join(',');
  return filters;
}

// ── Carga de datos ────────────────────────────────────────────────────────

async function reloadWithActiveFilters() {
  await loadReportes(getActiveFilters());
}

async function loadReportes(filters = {}) {
  try {
    const res = await window.ReportService.getMovimientosReport(filters);
    reportItems = res.data?.items || [];
    applyLocalFilters();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Filtrado local (texto) ────────────────────────────────────────────────

function applyLocalFilters() {
  const searchVal = document.getElementById('reportes-search')?.value?.trim().toLowerCase() || '';

  reportItemsVisible = reportItems.filter(item => {
    if (!searchVal) return true;
    return (item.producto_nombre || '').toLowerCase().includes(searchVal)
        || (item.usuario_nombre  || '').toLowerCase().includes(searchVal)
        || (item.motivo          || '').toLowerCase().includes(searchVal);
  });

  renderTablaReportes(reportItemsVisible);
  renderSummaryCards(reportItemsVisible);
}

// ── Renderizado ───────────────────────────────────────────────────────────

/** Actualiza los tres contadores del resumen superior. */
function renderSummaryCards(items) {
  const stats = items.reduce((acc, item) => {
    if (item.tipo in acc) acc[item.tipo]++;
    return acc;
  }, { entrada: 0, salida: 0, merma: 0 });

  const cards = document.querySelectorAll('.summary-grid .stat-card .stat-value');
  if (cards[0]) cards[0].textContent = String(stats.entrada);
  if (cards[1]) cards[1].textContent = String(stats.salida);
  if (cards[2]) cards[2].textContent = String(stats.merma);
}

/** Pinta la tabla de movimientos. */
function renderTablaReportes(items) {
  const tbody    = document.getElementById('reportes-tbody');
  const emptyMsg = document.getElementById('reportes-empty');
  if (!tbody) return;

  tbody.innerHTML = items.map(item => {
    const cantidad     = Number(item.cantidad || 0);
    const signedQty    = item.tipo === 'entrada' ? '+' + cantidad : '-' + cantidad;
    const revertidoTxt = item.revertido ? 'Revertido' : '—';

    return `<tr data-type="${item.tipo || ''}"
                data-product="${item.producto_nombre || ''}"
                data-user="${item.usuario_nombre || ''}"
                data-date="${toDateOnly(item.fecha_sistema)}">
      <td class="text-left">${formatDateTime(item.fecha_sistema)}</td>
      <td class="text-left">${tipoBadge(item.tipo)}</td>
      <td class="text-left">${window.escapeHtml(item.producto_nombre || 'Sin producto')}</td>
      <td class="td-num">${signedQty}</td>
      <td class="text-center">${window.escapeHtml(item.usuario_nombre || 'Sistema')}</td>
      <td class="text-center">${revertidoTxt}</td>
      <td>${window.escapeHtml(item.motivo || '—')}</td>
    </tr>`;
  }).join('');

  if (emptyMsg) emptyMsg.style.display = items.length === 0 ? 'block' : 'none';
}

// ── Exportación CSV ───────────────────────────────────────────────────────

function exportCSV() {
  if (!reportItems.length) { showToast(MSG.REPORTS.NO_DATA, 'info'); return; }

  const headers = ['Tipo', 'Producto', 'Cantidad', 'Fecha', 'Usuario', 'Motivo'];
  const lines   = [headers.join(',')];

  reportItems.forEach(item => {
    const row = [
      item.tipo               || '',
      item.producto_nombre    || '',
      item.cantidad != null   ? String(item.cantidad) : '',
      item.fecha_sistema      || '',
      item.usuario_nombre     || 'Sistema',
      item.motivo             || '',
    ].map(v => '"' + String(v).replace(/"/g, '""') + '"');
    lines.push(row.join(','));
  });

  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `movimientos_${new Date().toISOString().slice(0, 10)}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(MSG.REPORTS.CSV_SUCCESS, 'success');
}

// ── Inicialización ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initActiveNav();

  document.addEventListener('products:changed',  reloadWithActiveFilters);
  document.addEventListener('movements:changed', reloadWithActiveFilters);

  const savedState = restoreUIState();
  const searchInput = document.getElementById('reportes-search');
  const dateFrom    = document.getElementById('date-from');
  const dateTo      = document.getElementById('date-to');

  searchInput?.addEventListener('input',  () => { applyLocalFilters(); saveUIState(); });
  dateFrom   ?.addEventListener('change', () => { saveUIState(); reloadWithActiveFilters(); });
  dateTo     ?.addEventListener('change', () => { saveUIState(); reloadWithActiveFilters(); });

  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);

  reportTypeChipController = initFilterChips({
    chipSelector: '.filter-chip[data-type]',
    mode: 'multi',
    datasetKey: 'type',
    allValue: '',
    normalizeAllWhenAllSelected: true,
    onChange: () => { saveUIState(); reloadWithActiveFilters(); },
  });

  if (savedState?.tipos != null) restoreTypeChips(savedState.tipos);

  // Parámetro URL ?tipo= para pre-filtrar al navegar desde el dashboard
  const typeParam = new URLSearchParams(window.location.search).get('tipo')
    || new URLSearchParams(window.location.search).get('estado');
  if (typeParam) {
    document.querySelectorAll('.filter-chip').forEach(c => {
      if (c.dataset.type === typeParam) c.click();
    });
  }

  loadReportes(getActiveFilters());
  saveUIState();
});
