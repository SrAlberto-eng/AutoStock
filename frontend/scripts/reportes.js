/**
 * reportes.js
 * Filtros de movimientos: tipo (chip), búsqueda de texto, rango de fechas.
 * Exportación a CSV con datos obtenidos del backend.
 */

let reportTypeChipController = null;
let reportItems = [];
let reportItemsVisible = [];
const REPORTES_VIEW_NAME = 'reportes';

function saveReportesUIState() {
  if (!window.storageManager || typeof window.storageManager.saveUIState !== 'function') return;

  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  const selectedTypes = reportTypeChipController
    ? reportTypeChipController.getSelectedValues()
    : Array.from(document.querySelectorAll('.filter-chip.active'))
        .map(function (chip) { return chip.dataset.type; })
        .filter(function (type) { return type !== ''; });

  window.storageManager.saveUIState(REPORTES_VIEW_NAME, {
    tipos: selectedTypes.join(','),
    fecha_desde: dateFrom ? dateFrom.value || '' : '',
    fecha_hasta: dateTo ? dateTo.value || '' : '',
  });
}

function restoreReportesUIState() {
  if (!window.storageManager || typeof window.storageManager.loadUIState !== 'function') return null;

  const saved = window.storageManager.loadUIState(REPORTES_VIEW_NAME);
  if (!saved) return null;

  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');

  if (dateFrom && saved.fecha_desde != null) dateFrom.value = String(saved.fecha_desde);
  if (dateTo && saved.fecha_hasta != null) dateTo.value = String(saved.fecha_hasta);
  return saved;
}

function applySavedReportesTipos(savedTipos) {
  if (!savedTipos) return;

  const wanted = String(savedTipos)
    .split(',')
    .map(function (value) { return value.trim(); })
    .filter(function (value) { return value !== ''; });

  if (!wanted.length) return;

  const chips = Array.from(document.querySelectorAll('.filter-chip[data-type]'));
  const allChip = chips.find(function (chip) { return (chip.dataset.type || '') === ''; });
  chips.forEach(function (chip) {
    const isActive = wanted.indexOf(chip.dataset.type || '') !== -1;
    chip.classList.toggle('active', isActive);
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  if (allChip) {
    allChip.classList.toggle('active', false);
    allChip.setAttribute('aria-pressed', 'false');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initActiveNav();

  // Escuchar cambios en productos y movimientos para recargar reportes
  document.addEventListener('products:changed', reloadWithActiveFilters);
  document.addEventListener('movements:changed', reloadWithActiveFilters);

  const searchInput = document.getElementById('reportes-search');
  const dateFrom    = document.getElementById('date-from');
  const dateTo      = document.getElementById('date-to');
  const savedReportesState = restoreReportesUIState();

  searchInput && searchInput.addEventListener('input', function () {
    applyFilters();
    saveReportesUIState();
  });
  dateFrom    && dateFrom.addEventListener('change', function () {
    saveReportesUIState();
    reloadWithActiveFilters();
  });
  dateTo      && dateTo.addEventListener('change', function () {
    saveReportesUIState();
    reloadWithActiveFilters();
  });

  reportTypeChipController = initFilterChips({
    chipSelector: '.filter-chip[data-type]',
    mode: 'multi',
    datasetKey: 'type',
    allValue: '',
    normalizeAllWhenAllSelected: true,
    onChange: function () {
      saveReportesUIState();
      reloadWithActiveFilters();
    },
  });

  if (savedReportesState && savedReportesState.tipos != null) {
    applySavedReportesTipos(savedReportesState.tipos);
  }

  // Leer parámetro URL (?tipo= o legacy ?estado=) y pre-seleccionar el chip.
  const params = new URLSearchParams(window.location.search);
  const typeParam = params.get('tipo') || params.get('estado');
  if (typeParam) {
    document.querySelectorAll('.filter-chip').forEach(c => {
      if (c.dataset.type === typeParam) c.click();
    });
  }
  loadReportes(getActiveFilters());
  saveReportesUIState();
});

function getActiveFilters() {
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  const selectedTypes = reportTypeChipController
    ? reportTypeChipController.getSelectedValues()
    : Array.from(document.querySelectorAll('.filter-chip.active'))
        .map(function (chip) { return chip.dataset.type; })
        .filter(function (type) { return type !== ''; });

  const filters = {
    skip: 0,
    limit: 50,
  };

  if (dateFrom && dateFrom.value) filters.fecha_desde = dateFrom.value;
  if (dateTo && dateTo.value) filters.fecha_hasta = dateTo.value;
  if (selectedTypes.length === 1) {
    filters.tipo = selectedTypes[0];
  } else if (selectedTypes.length > 1) {
    filters.tipos = selectedTypes.join(',');
  }

  return filters;
}

async function reloadWithActiveFilters() {
  await loadReportes(getActiveFilters());
}

async function loadReportes(filters = {}) {
  try {
    const res = await window.ReportService.getMovimientosReport(filters);
    reportItems = (res.data && res.data.items) ? res.data.items : [];
    applyFilters();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function applyFilters() {
  const searchVal = (document.getElementById('reportes-search').value || '').trim().toLowerCase();
  reportItemsVisible = reportItems.filter(function (item) {
    if (!searchVal) return true;
    const product = (item.producto_nombre || '').toLowerCase();
    const user = (item.usuario_nombre || '').toLowerCase();
    const motive = (item.motivo || '').toLowerCase();
    return product.includes(searchVal) || user.includes(searchVal) || motive.includes(searchVal);
  });

  renderTablaReportes(reportItemsVisible);
  renderSummaryCards(reportItemsVisible);
}

function renderSummaryCards(items) {
  const stats = {
    entrada: 0,
    salida: 0,
    merma: 0,
  };

  items.forEach(function (item) {
    if (stats[item.tipo] !== undefined) {
      stats[item.tipo] += 1;
    }
  });

  const statValues = document.querySelectorAll('.summary-grid .stat-card .stat-value');
  if (statValues[0]) statValues[0].textContent = String(stats.entrada);
  if (statValues[1]) statValues[1].textContent = String(stats.salida);
  if (statValues[2]) statValues[2].textContent = String(stats.merma);
}

function renderTablaReportes(items) {
  const tbody = document.getElementById('reportes-tbody');
  const emptyMsg = document.getElementById('reportes-empty');
  if (!tbody) return;

  tbody.innerHTML = '';

  items.forEach(function (item) {
    const tr = document.createElement('tr');
    tr.dataset.type = item.tipo || '';
    tr.dataset.product = item.producto_nombre || '';
    tr.dataset.user = item.usuario_nombre || '';
    tr.dataset.date = toDateOnly(item.fecha_sistema);

    const cantidad = Number(item.cantidad || 0);
    const signedCantidad = item.tipo === 'entrada'
      ? '+' + cantidad
      : '-' + cantidad;

    tr.innerHTML = [
      '<td class="text-left">' + formatDateTime(item.fecha_sistema) + '</td>',
      '<td class="text-left">' + renderTipoBadge(item.tipo) + '</td>',
      '<td class="text-left">' + window.escapeHtml(item.producto_nombre || 'Sin producto') + '</td>',
      '<td class="td-num">' + signedCantidad + '</td>',
      '<td class="text-center">' + window.escapeHtml(item.usuario_nombre || 'Sistema') + '</td>',
      '<td class="text-center">' + (item.revertido ? 'Revertido' : '—') + '</td>',
      '<td>' + window.escapeHtml(item.motivo || '—') + '</td>',
    ].join('');

    tbody.appendChild(tr);
  });

  if (emptyMsg) {
    emptyMsg.style.display = items.length === 0 ? 'block' : 'none';
  }
}

function renderTipoBadge(tipo) {
  if (tipo === 'entrada') return '<span class="badge badge-success">Entrada</span>';
  if (tipo === 'salida') return '<span class="badge badge-primary">Salida</span>';
  return '<span class="badge badge-warning">Merma</span>';
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateOnly(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

// ── CSV Export ─────────────────────────────────────────────────────────────
function exportCSV() {
  const headers = ['Tipo', 'Producto', 'Cantidad', 'Fecha', 'Usuario', 'Motivo'];
  const rows = reportItems;

  if (!rows || rows.length === 0) {
    showToast('No hay datos para exportar', 'info');
    return;
  }

  const csvLines = [headers.join(',')];
  rows.forEach(item => {
    const line = [
      item.tipo || '',
      item.producto_nombre || '',
      item.cantidad !== undefined ? String(item.cantidad) : '',
      item.fecha_sistema || '',
      item.usuario_nombre || 'Sistema',
      item.motivo || '',
    ].map(function (value) {
      return '"' + String(value).replace(/"/g, '""') + '"';
    });
    csvLines.push(line.join(','));
  });

  const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('CSV exportado correctamente', 'success');
}
