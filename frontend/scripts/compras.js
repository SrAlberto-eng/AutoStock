/**
 * compras.js
 * Lista de compras en tiempo real: ajuste de cantidades en memoria,
 * eliminación de filas, totales, exportación PDF e impresión.
 */
import { MSG }                              from './constants/messages.js';
import { slugify }                          from './utils.js';
import { showToast }                        from './toast.js';
import { storageManager }                   from './storage-manager.js';
import { FilterEngine }                     from './filter-engine.js';
import { escapeHtml }                       from './sanitizers.js';
import { PurchaseService, CatalogService, ProviderService } from './services.js';
import { initActiveNav } from './layout.js';

const COMPRAS_VIEW_NAME = 'compras';

/** Copia local de los ítems para cálculos en memoria. */
let comprasItems = [];
let comprasFilterEngine = null;

// ── Persistencia de filtros ───────────────────────────────────────────────

function saveUIState() {
  if (typeof storageManager?.saveUIState !== 'function') return;
  storageManager.saveUIState(COMPRAS_VIEW_NAME, {
    categoria: document.getElementById('filter-category')?.value || '',
    proveedor: document.getElementById('filter-provider')?.value  || '',
  });
}

function restoreUIState() {
  if (typeof storageManager?.loadUIState !== 'function') return;
  const saved = storageManager.loadUIState(COMPRAS_VIEW_NAME);
  if (!saved) return;
  const categoryFilter = document.getElementById('filter-category');
  const providerFilter  = document.getElementById('filter-provider');
  if (categoryFilter && saved.categoria != null) categoryFilter.value = String(saved.categoria);
  if (providerFilter  && saved.proveedor  != null) providerFilter.value  = String(saved.proveedor);
}

// ── Carga de datos ────────────────────────────────────────────────────────

/** Carga la lista de compras del backend y repinta la tabla. */
async function loadCompras() {
  try {
    const res = await PurchaseService.getAll();
    comprasItems = res.data?.items || [];
    await populateFilterOptions(comprasItems);
    renderTablaCompras(comprasItems);
    syncTotals(comprasItems);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/** Rellena los selects de categoría y proveedor con opciones únicas. */
async function populateFilterOptions(items) {
  const categoryFilter = document.getElementById('filter-category');
  const providerFilter  = document.getElementById('filter-provider');

  if (categoryFilter) {
    const selected = categoryFilter.value;
    const categories = await fetchCategoryNames(items);
    categoryFilter.innerHTML = '<option value="">Todas las categorías</option>'
      + categories.sort().map(c =>
          `<option value="${slugify(c)}">${escapeHtml(c)}</option>`
        ).join('');
    categoryFilter.value = selected;
  }

  if (providerFilter) {
    const selected = providerFilter.value;
    const providers = await fetchProviderNames(items);
    providerFilter.innerHTML = '<option value="">Todos los proveedores</option>'
      + providers.sort().map(p =>
          `<option value="${slugify(p)}">${escapeHtml(p)}</option>`
        ).join('');
    providerFilter.value = selected;
  }
}

/** Obtiene nombres de categorías desde el catálogo; usa los ítems como fallback. */
async function fetchCategoryNames(items) {
  try {
    const cats = await CatalogService.getAllCatalogs();
    if (Array.isArray(cats?.categorias) && cats.categorias.length) {
      return cats.categorias.map(c => c.nombre);
    }
  } catch (_) {}
  return [...new Set(items.map(i => i.categoria_nombre).filter(Boolean))];
}

/** Obtiene nombres de proveedores; usa los ítems como fallback. */
async function fetchProviderNames(items) {
  try {
    const res = await ProviderService.getAll();
    if (Array.isArray(res?.data?.items) && res.data.items.length) {
      return res.data.items.map(p => p.nombre);
    }
  } catch (_) {}
  return [...new Set(items.map(i => i.proveedor_nombre).filter(Boolean))];
}

// ── Renderizado ───────────────────────────────────────────────────────────

/**
 * Retorna la cantidad a mostrar para un ítem (ajustada > sugerida > 0).
 * @param {object} item
 */
function getDisplayQty(item) {
  const qty = item.cantidad_ajustada ?? item.cantidad_sugerida ?? 0;
  return Number.isFinite(Number(qty)) ? Number(qty) : 0;
}

/**
 * Clase CSS para la celda de stock actual según su nivel.
 * @param {boolean} hasStock
 * @param {number|null} stockActual
 * @param {number} stockMin
 */
function stockCellClass(hasStock, stockActual, stockMin) {
  if (!hasStock) return 'text-muted';
  if (stockActual === 0) return 'text-zero';
  if (stockActual > 0 && stockActual < stockMin) return 'text-warning';
  return '';
}

/** Pinta toda la tabla de compras con los ítems recibidos. */
function renderTablaCompras(items) {
  const tbody = document.getElementById('compras-tbody');
  if (!tbody) return;

  tbody.innerHTML = items.map(item => {
    const qty        = getDisplayQty(item);
    const category   = item.categoria_nombre  || 'Sin categoría';
    const provider   = item.proveedor_nombre  || 'Sin proveedor';
    const area       = item.area_nombre       || 'Sin área';
    const unit       = item.unidad_nombre     || 'N/A';
    const stockActual = item.stock_actual != null ? Number(item.stock_actual) : null;
    const stockMin    = item.stock_min ?? 0;
    const stockLabel  = stockActual != null ? stockActual : '-';
    const cellClass   = stockCellClass(stockActual != null, stockActual, stockMin);

    return `
      <tr data-product-id="${item.producto_id}"
          data-category="${slugify(category)}"
          data-provider="${slugify(provider)}">
        <td>${escapeHtml(item.nombre_producto)}</td>
        <td>${escapeHtml(category)}</td>
        <td>${escapeHtml(area)}</td>
        <td class="td-num ${cellClass}">${escapeHtml(String(stockLabel))}</td>
        <td class="td-num">${escapeHtml(String(stockMin))}</td>
        <td>${escapeHtml(unit)}</td>
        <td>
          <input type="number" min="1" value="${qty}"
            class="input compras-qty-input" style="width:90px;"
            aria-label="Cantidad a comprar"
            data-product-id="${item.producto_id}">
        </td>
        <td class="no-print td-actions">
          <button class="btn btn-ghost btn-icon" data-action="remove" aria-label="Quitar de la lista">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  comprasFilterEngine ? comprasFilterEngine.apply() : updateEmptyState();
}

// ── Acciones de tabla ─────────────────────────────────────────────────────

/**
 * Actualiza la cantidad ajustada del ítem en memoria cuando el input pierde el foco.
 * @param {HTMLInputElement} input
 */
function updateQty(input) {
  const val = parseInt(input.value, 10);
  if (!Number.isFinite(val) || val < 1) input.value = 1;

  const productId = Number(input.dataset.productId || input.closest('tr')?.dataset.productId);
  if (!productId) return;

  const index = comprasItems.findIndex(i => i.producto_id === productId);
  if (index >= 0) comprasItems[index].cantidad_ajustada = parseInt(input.value, 10);

  updateTotals();
}

/**
 * Elimina la fila de compra con una animación de fade.
 * @param {HTMLElement} btn - Botón dentro de la fila.
 */
function removeCompraRow(btn) {
  const row = btn.closest('tr');
  if (!row) return;

  const productId = Number(row.dataset.productId);
  if (productId) comprasItems = comprasItems.filter(i => i.producto_id !== productId);

  row.style.transition = 'opacity 200ms ease';
  row.style.opacity = '0';
  setTimeout(() => {
    row.remove();
    updateTotals();
    updateEmptyState();
  }, 200);
}

// ── Totales y estado vacío ────────────────────────────────────────────────

function updateTotals() {
  const rows = document.querySelectorAll('#compras-tbody tr:not([style*="display: none"])');
  let totalUnits = 0;
  rows.forEach(row => {
    const input = row.querySelector('.compras-qty-input');
    if (input) totalUnits += parseInt(input.value, 10) || 0;
  });

  const setTextById = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setTextById('total-items', rows.length);
  setTextById('total-units', totalUnits);
  setTextById('compras-count', rows.length);
}

/**
 * Sincroniza los contadores con el array de ítems recién cargado.
 * @param {object[]} items
 */
function syncTotals(items) {
  const totalUnits = items.reduce((sum, i) => sum + getDisplayQty(i), 0);
  const setTextById = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setTextById('total-items', items.length);
  setTextById('total-units', totalUnits);
  setTextById('compras-count', items.length);
  updateEmptyState(items.length, items.length);
  comprasFilterEngine?.apply();
}

function updateEmptyState(visibleOverride, totalOverride) {
  const tbody    = document.getElementById('compras-tbody');
  const emptyMsg = document.getElementById('compras-empty');
  if (!tbody || !emptyMsg) return;

  const total   = typeof totalOverride   === 'number' ? totalOverride   : tbody.querySelectorAll('tr').length;
  const visible = typeof visibleOverride === 'number' ? visibleOverride : tbody.querySelectorAll('tr:not([style*="display: none"])').length;

  if (total === 0)   { emptyMsg.textContent = MSG.PURCHASES.NO_PRODUCTS;     emptyMsg.style.display = 'block'; return; }
  if (visible === 0) { emptyMsg.textContent = MSG.PURCHASES.NO_MATCH_FILTERS; emptyMsg.style.display = 'block'; return; }
  emptyMsg.style.display = 'none';
}

// ── Impresión y exportación ───────────────────────────────────────────────

function printCompras() {
  const printWindow = window.open('', '_blank', 'width=1024,height=768');
  if (!printWindow) { showToast(MSG.PURCHASES.PRINT_BLOCKED, 'error'); return; }

  const usuario = localStorage.getItem('as_nombre') || 'Usuario no identificado';
  printWindow.document.open();
  printWindow.document.write(buildPrintMarkup(comprasItems, new Date().toISOString(), usuario));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function exportPDF() {
  if (!comprasItems.length) { showToast(MSG.PURCHASES.NO_PRODUCTS_EXPORT, 'error'); return; }

  const printWindow = window.open('', '_blank', 'width=1024,height=768');
  if (!printWindow) { showToast(MSG.PURCHASES.PRINT_BLOCKED, 'error'); return; }

  const usuario = localStorage.getItem('as_nombre') || 'Usuario no identificado';
  printWindow.document.open();
  printWindow.document.write(buildPrintMarkup(comprasItems, new Date().toISOString(), usuario));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

/** Genera el HTML completo de la ventana de impresión. */
function buildPrintMarkup(items, fechaIso, usuario) {
  const fecha  = new Date(fechaIso).toLocaleString('es-MX');
  const rows = items.map(item => {
    const qty = getDisplayQty(item);
    return `<tr>
      <td>${escapeHtml(item.nombre_producto)}</td>
      <td>${escapeHtml(item.categoria_nombre || 'Sin categoría')}</td>
      <td>${escapeHtml(item.area_nombre      || 'Sin área')}</td>
      <td>${escapeHtml(item.unidad_nombre    || 'N/A')}</td>
      <td style="text-align:right;">${escapeHtml(String(item.stock_actual ?? 0))}</td>
      <td style="text-align:right;">${escapeHtml(String(item.stock_min   ?? 0))}</td>
      <td style="text-align:right;">${escapeHtml(String(qty))}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
  <html lang="es"><head><meta charset="UTF-8"><title>Lista de Compras</title>
  <style>
    body { font-family:'Segoe UI',sans-serif; margin:32px; color:#1f2937; }
    h1   { margin-bottom:8px; }
    .meta { margin-bottom:20px; color:#4b5563; }
    table { width:100%; border-collapse:collapse; }
    th, td { border:1px solid #d1d5db; padding:8px 10px; font-size:12px; }
    th { background:#f3f4f6; text-align:left; }
  </style></head><body>
    <h1>Lista de Compras</h1>
    <div class="meta">Fecha: ${escapeHtml(fecha)}<br>Usuario: ${escapeHtml(usuario)}</div>
    <table>
      <thead><tr>
        <th>Producto</th><th>Categoría</th><th>Área</th><th>Unidad</th>
        <th>Stock actual</th><th>Stock mínimo</th><th>Cantidad a comprar</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

// ── Inicialización ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initActiveNav();
  restoreUIState();

  comprasFilterEngine = new FilterEngine({
    rowSelector: '#compras-tbody tr',
    getCriteria: () => ({
      category: document.getElementById('filter-category')?.value?.toLowerCase() || '',
      provider: document.getElementById('filter-provider')?.value?.toLowerCase() || '',
    }),
    mapRow: row => ({
      rowCategory: (row.dataset.category || '').toLowerCase(),
      rowProvider:  (row.dataset.provider  || '').toLowerCase(),
    }),
    predicates: [
      (c, r) => !c.category || r.rowCategory === c.category,
      (c, r) => !c.provider  || r.rowProvider  === c.provider,
    ],
    setEmptyState: result => updateEmptyState(result.visible, result.total),
    onAfterApply:  ()     => updateTotals(),
  });

  comprasFilterEngine.bindTriggers([
    { selector: '#filter-category', event: 'change' },
    { selector: '#filter-provider', event: 'change' },
  ]);

  document.getElementById('filter-category')?.addEventListener('change', saveUIState);
  document.getElementById('filter-provider')?.addEventListener('change', saveUIState);

  // Botones estáticos de la barra de acciones
  document.getElementById('btn-refresh-compras')?.addEventListener('click', loadCompras);
  document.getElementById('btn-print-compras')  ?.addEventListener('click', printCompras);
  document.getElementById('btn-export-pdf')     ?.addEventListener('click', exportPDF);

  // Event delegation: click (remove) y focusout (qty update)
  const tbody = document.getElementById('compras-tbody');
  tbody?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="remove"]');
    if (btn) removeCompraRow(btn);
  });
  tbody?.addEventListener('focusout', e => {
    const input = e.target.closest('.compras-qty-input');
    if (input) updateQty(input);
  });

  await loadCompras();
  saveUIState();
});
