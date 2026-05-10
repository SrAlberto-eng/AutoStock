/**
 * reportes.js
 * Historial de movimientos con filtros por tipo (chips), texto y fechas.
 * Exportación a CSV con BOM para compatibilidad Excel.
 */
import { MSG }                           from './constants/messages.js';
import { formatDateTime, toDateOnly }    from './utils.js';
import { tipoBadge }                     from './ui-helpers.js';
import { showToast }                     from './toast.js';
import { escapeHtml }                    from './sanitizers.js';
import { storageManager }                from './storage-manager.js';
import { initFilterChips }               from './filter-chips.js';
import { ReportService }                 from './services.js';
import { initActiveNav }                 from './layout.js';
import { DateRangePicker }               from './date-range-picker.js';

const REPORTES_VIEW_NAME = 'reportes';

let reportTypeChipController = null;
let dateRangePicker           = null;
/** Todos los movimientos cargados desde el backend. */
let reportItems = [];
/** Subconjunto visible tras aplicar el filtro de texto. */
let reportItemsVisible = [];

// ── Persistencia de filtros ───────────────────────────────────────────────

function saveUIState() {
  if (typeof storageManager?.saveUIState !== 'function') return;
  const { from, to } = dateRangePicker?.getValue() ?? { from: '', to: '' };
  storageManager.saveUIState(REPORTES_VIEW_NAME, {
    tipos:        getSelectedTypes().join(','),
    fecha_desde:  from || '',
    fecha_hasta:  to   || '',
  });
}

function restoreUIState() {
  if (typeof storageManager?.loadUIState !== 'function') return null;
  return storageManager.loadUIState(REPORTES_VIEW_NAME) || null;
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
  const { from, to } = dateRangePicker?.getValue() ?? {};
  const types = getSelectedTypes();

  const filters = { skip: 0, limit: 50 };
  if (from) filters.fecha_desde = from;
  if (to)   filters.fecha_hasta = to;
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
    const res = await ReportService.getMovimientosReport(filters);
    reportItems = res.data?.items || [];
    applyLocalFilters();
  } catch (err) {
    renderTablaReportes([]);
    renderSummaryCards([]);
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
  document.querySelector('.summary-grid')?.removeAttribute('data-skeleton');
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
      <td class="text-left">${escapeHtml(item.producto_nombre || 'Sin producto')}</td>
      <td class="td-num">${signedQty}</td>
      <td class="text-center">${escapeHtml(item.usuario_nombre || 'Sistema')}</td>
      <td class="text-center">${revertidoTxt}</td>
      <td>${escapeHtml(item.motivo || '—')}</td>
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

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
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

  const savedState  = restoreUIState();
  const searchInput = document.getElementById('reportes-search');

  dateRangePicker = new DateRangePicker({
    containerId:   'date-range-picker-container',
    initialFrom:   savedState?.fecha_desde || null,
    initialTo:     savedState?.fecha_hasta || null,
    onChange: () => { saveUIState(); reloadWithActiveFilters(); },
  });

  searchInput?.addEventListener('input', () => { applyLocalFilters(); saveUIState(); });

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
