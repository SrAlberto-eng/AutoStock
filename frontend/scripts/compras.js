/**
 * compras.js
 * Lista de compras: actualización de cantidades, eliminación de filas,
 * totales en tiempo real, exportación PDF e impresión.
 */

let comprasFilterEngine = null;
let comprasItems = [];
const COMPRAS_VIEW_NAME = 'compras';

function saveComprasUIState() {
  if (!window.storageManager || typeof window.storageManager.saveUIState !== 'function') return;

  var categoryFilter = document.getElementById('filter-category');
  var providerFilter = document.getElementById('filter-provider');
  window.storageManager.saveUIState(COMPRAS_VIEW_NAME, {
    categoria: categoryFilter ? categoryFilter.value || '' : '',
    proveedor: providerFilter ? providerFilter.value || '' : '',
  });
}

function restoreComprasUIState() {
  if (!window.storageManager || typeof window.storageManager.loadUIState !== 'function') return;

  var saved = window.storageManager.loadUIState(COMPRAS_VIEW_NAME);
  if (!saved) return;

  var categoryFilter = document.getElementById('filter-category');
  var providerFilter = document.getElementById('filter-provider');
  if (categoryFilter && saved.categoria != null) categoryFilter.value = String(saved.categoria);
  if (providerFilter && saved.proveedor != null) providerFilter.value = String(saved.proveedor);
}

document.addEventListener('DOMContentLoaded', async () => {
  initActiveNav();
  restoreComprasUIState();

  comprasFilterEngine = new FilterEngine({
    rowSelector: '#compras-tbody tr',
    getCriteria: function () {
      return {
        category: (document.getElementById('filter-category')?.value || '').toLowerCase(),
        provider: (document.getElementById('filter-provider')?.value || '').toLowerCase(),
      };
    },
    mapRow: function (row) {
      return {
        rowCategory: (row.dataset.category || '').toLowerCase(),
        rowProvider: (row.dataset.provider || '').toLowerCase(),
      };
    },
    predicates: [
      function (criteria, rowData) {
        return !criteria.category || rowData.rowCategory === criteria.category;
      },
      function (criteria, rowData) {
        return !criteria.provider || rowData.rowProvider === criteria.provider;
      },
    ],
    setEmptyState: function (result) {
      updateEmptyState(result.visible, result.total);
    },
    onAfterApply: function () {
      updateTotals();
    },
  });

  comprasFilterEngine.bindTriggers([
    { selector: '#filter-category', event: 'change' },
    { selector: '#filter-provider', event: 'change' },
  ]);

  var categoryFilter = document.getElementById('filter-category');
  var providerFilter = document.getElementById('filter-provider');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', saveComprasUIState);
  }
  if (providerFilter) {
    providerFilter.addEventListener('change', saveComprasUIState);
  }

  await loadCompras();
  saveComprasUIState();
});

async function loadCompras() {
  try {
    const res = await window.PurchaseService.getAll();
    const items = res.data?.items || [];
    comprasItems = items;
    populateFilterOptions(items);
    renderTablaCompras(items);
    calcularTotal(items);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function populateFilterOptions(items) {
  var categoryFilter = document.getElementById('filter-category');
  var providerFilter = document.getElementById('filter-provider');

  // Load categories from CatalogService
  if (categoryFilter) {
    var selected = categoryFilter.value;
    var categories = [];
    try {
      var cats = await window.CatalogService.getAllCatalogs();
      if (cats && Array.isArray(cats.categorias)) {
        categories = cats.categorias.map(function (c) { return c.nombre; });
      }
    } catch (_) {}
    // Fallback: also add categories from items in case API fails
    if (!categories.length) {
      var catSet = new Set();
      items.forEach(function (item) { if (item.categoria_nombre) catSet.add(item.categoria_nombre); });
      categories = Array.from(catSet);
    }
    categoryFilter.innerHTML = '<option value="">Todas las categorías</option>'
      + categories.sort().map(function (c) {
        return '<option value="' + normalizeFilterValue(c) + '">' + window.escapeHtml(c) + '</option>';
      }).join('');
    categoryFilter.value = selected;
  }

  // Load providers from ProviderService
  if (providerFilter) {
    var selected = providerFilter.value;
    var providers = [];
    try {
      var res = await window.ProviderService.getAll();
      if (res && res.data && Array.isArray(res.data.items)) {
        providers = res.data.items.map(function (p) { return p.nombre; });
      }
    } catch (_) {}
    if (!providers.length) {
      var provSet = new Set();
      items.forEach(function (item) { if (item.proveedor_nombre) provSet.add(item.proveedor_nombre); });
      providers = Array.from(provSet);
    }
    providerFilter.innerHTML = '<option value="">Todos los proveedores</option>'
      + providers.sort().map(function (p) {
        return '<option value="' + normalizeFilterValue(p) + '">' + window.escapeHtml(p) + '</option>';
      }).join('');
    providerFilter.value = selected;
  }
}


function normalizeFilterValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getDisplayQty(item) {
  const qty = item.cantidad_ajustada ?? item.cantidad_sugerida ?? 0;
  return Number.isFinite(Number(qty)) ? Number(qty) : 0;
}

function renderTablaCompras(items) {
  const tbody = document.getElementById('compras-tbody');
  if (!tbody) {
    return;
  }

  tbody.innerHTML = items.map(item => {
    const qty = getDisplayQty(item);
    const category = item.categoria_nombre || 'Sin categoría';
    const provider = item.proveedor_nombre || 'Sin proveedor';
    const area = item.area_nombre || 'Sin área';
    const unit = item.unidad_nombre || 'N/A';
    const hasStockActual = item.stock_actual !== null && item.stock_actual !== undefined;
    const stockActual = hasStockActual ? Number(item.stock_actual) : null;
    const stockMin = item.stock_min ?? 0;
    const stockLabel = hasStockActual ? item.stock_actual : '-';

    let stockColor = '#E6E6E6';
    if (!hasStockActual) {
      stockColor = '#9AA0A6';
    } else if (Number.isFinite(stockActual) && stockActual === 0) {
      stockColor = '#FF6B6B';
    } else if (Number.isFinite(stockActual) && stockActual > 0 && stockActual < stockMin) {
      stockColor = '#FFB86B';
    }

    return `
      <tr data-product-id="${item.producto_id}" data-category="${normalizeFilterValue(category)}" data-provider="${normalizeFilterValue(provider)}">
        <td>${window.escapeHtml(item.nombre_producto)}</td>
        <td>${window.escapeHtml(category)}</td>
        <td>${window.escapeHtml(area)}</td>
        <td class="td-num" style="color:${stockColor};">${window.escapeHtml(String(stockLabel))}</td>
        <td class="td-num">${window.escapeHtml(String(stockMin))}</td>
        <td>${window.escapeHtml(unit)}</td>
        <td>
          <input
            type="number" min="1" value="${window.escapeHtml(qty)}"
            class="input compras-qty-input" style="width:90px;"
            aria-label="Cantidad a comprar"
            data-product-id="${item.producto_id}"
            onblur="updateQty(this)"
          >
        </td>
        <td class="no-print td-actions">
          <button class="btn btn-ghost btn-icon" onclick="removeCompraRow(this)" aria-label="Quitar de la lista">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (comprasFilterEngine) {
    comprasFilterEngine.apply();
  } else {
    updateTotals();
    updateEmptyState();
  }
}

function applyFilters() {
  if (comprasFilterEngine) comprasFilterEngine.apply();
}

// ── Quantity update (in-memory only) ──────────────────────────────────────
function updateQty(input) {
  const val = parseInt(input.value);
  if (isNaN(val) || val < 1) {
    input.value = 1;
  }

  const productId = Number(input.dataset.productId || input.closest('tr')?.dataset.productId);
  if (productId) {
    const index = comprasItems.findIndex(item => item.producto_id === productId);
    if (index >= 0) {
      comprasItems[index].cantidad_ajustada = parseInt(input.value, 10);
    }
  }

  updateTotals();
}

// ── Remove row (in-memory only) ────────────────────────────────────────────
function removeCompraRow(btn) {
  const row = btn.closest('tr');
  if (!row) return;

  const productId = Number(row.dataset.productId);
  if (productId) {
    comprasItems = comprasItems.filter(item => item.producto_id !== productId);
  }

  row.style.transition = 'opacity 200ms ease';
  row.style.opacity = '0';
  setTimeout(() => {
    row.remove();
    updateTotals();
    updateEmptyState();
  }, 200);
}

// ── Totals ─────────────────────────────────────────────────────────────────
function updateTotals() {
  const rows = document.querySelectorAll('#compras-tbody tr:not([style*="display: none"])');
  let totalUnits = 0;
  rows.forEach(row => {
    const qtyInput = row.querySelector('.compras-qty-input');
    if (qtyInput) totalUnits += parseInt(qtyInput.value) || 0;
  });

  const totalItemsEl = document.getElementById('total-items');
  const totalUnitsEl = document.getElementById('total-units');
  const countEl      = document.getElementById('compras-count');
  if (totalItemsEl) totalItemsEl.textContent = rows.length;
  if (totalUnitsEl) totalUnitsEl.textContent = totalUnits;
  if (countEl)      countEl.textContent = rows.length;
}

function calcularTotal(items) {
  const totalUnits = items.reduce((sum, item) => sum + getDisplayQty(item), 0);
  const totalItemsEl = document.getElementById('total-items');
  const totalUnitsEl = document.getElementById('total-units');
  const countEl = document.getElementById('compras-count');

  if (totalItemsEl) totalItemsEl.textContent = items.length;
  if (totalUnitsEl) totalUnitsEl.textContent = totalUnits;
  if (countEl) countEl.textContent = items.length;

  updateEmptyState(items.length, items.length);
  if (comprasFilterEngine) {
    comprasFilterEngine.apply();
  }
}

function updateEmptyState(visibleRowsOverride, totalRowsOverride) {
  const tbody = document.getElementById('compras-tbody');
  const emptyMsg = document.getElementById('compras-empty');
  if (!tbody || !emptyMsg) return;

  const totalRows = typeof totalRowsOverride === 'number'
    ? totalRowsOverride
    : tbody.querySelectorAll('tr').length;
  const visibleRows = typeof visibleRowsOverride === 'number'
    ? visibleRowsOverride
    : tbody.querySelectorAll('tr:not([style*="display: none"])').length;

  if (totalRows === 0) {
    emptyMsg.textContent = 'No hay productos en la lista de compras.';
    emptyMsg.style.display = 'block';
    return;
  }

  if (visibleRows === 0) {
    emptyMsg.textContent = 'No se encontraron productos con los filtros aplicados.';
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';
}

// ── Print ──────────────────────────────────────────────────────────────────
function printCompras() {
  const usuario = localStorage.getItem('as_nombre') || 'Usuario no identificado';
  const printWindow = window.open('', '_blank', 'width=1024,height=768');
  if (!printWindow) {
    showToast('El navegador bloqueó la ventana de impresión.', 'error');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintMarkup(comprasItems || [], new Date().toISOString(), usuario));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function buildPrintMarkup(items, fechaExportacion, usuario) {
  const fecha = fechaExportacion ? new Date(fechaExportacion).toLocaleString('es-MX') : new Date().toLocaleString('es-MX');
  const nombreUsuario = usuario || localStorage.getItem('as_nombre') || 'Usuario no identificado';
  const rows = items.map(item => {
    const qty = getDisplayQty(item);
    return `
      <tr>
        <td>${window.escapeHtml(item.nombre_producto)}</td>
        <td>${window.escapeHtml(item.categoria_nombre || 'Sin categoría')}</td>
        <td>${window.escapeHtml(item.area_nombre || 'Sin área')}</td>
        <td>${window.escapeHtml(item.unidad_nombre || 'N/A')}</td>
        <td style="text-align:right;">${window.escapeHtml(item.stock_actual ?? 0)}</td>
        <td style="text-align:right;">${window.escapeHtml(item.stock_min ?? 0)}</td>
        <td style="text-align:right;">${window.escapeHtml(qty)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Lista de Compras</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 32px; color: #1f2937; }
        h1 { margin-bottom: 8px; }
        .meta { margin-bottom: 20px; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 12px; }
        th { background: #f3f4f6; text-align: left; }
      </style>
    </head>
    <body>
      <h1>Lista de Compras</h1>
      <div class="meta">Fecha: ${window.escapeHtml(fecha)}<br>Usuario: ${window.escapeHtml(nombreUsuario)}</div>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Área</th>
            <th>Unidad</th>
            <th>Stock actual</th>
            <th>Stock mínimo</th>
            <th>Cantidad a comprar</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`;
}

// ── Export PDF ─────────────────────────────────────────────────────────────
function exportPDF() {
  const items = comprasItems || [];
  if (items.length === 0) {
    showToast('No hay productos para exportar.', 'error');
    return;
  }

  const usuario = localStorage.getItem('as_nombre') || 'Usuario no identificado';
  const printWindow = window.open('', '_blank', 'width=1024,height=768');

  if (!printWindow) {
    showToast('El navegador bloqueó la ventana de impresión.', 'error');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintMarkup(items, new Date().toISOString(), usuario));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
