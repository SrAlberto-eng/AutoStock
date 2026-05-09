/**
 * inventario.js
 * Tabla de productos con filtros, chips de estado, detalle modal,
 * alta en lote (nuevos + existentes) e importación desde XML CFDI.
 */
import { MSG }                                      from './constants/messages.js';
import { slugify, normalizeSearch, toStatusKey }    from './utils.js';
import { statusBadge, activoBadge, tipoBadge }      from './ui-helpers.js';
import { showToast }                                from './toast.js';
import { store }                                    from './store.js';
import { storageManager }                           from './storage-manager.js';
import { FilterEngine }                             from './filter-engine.js';
import { initFilterChips }                          from './filter-chips.js';
import { escapeHtml }                               from './sanitizers.js';
import { ProductService, CatalogService, MovementService, ProviderService } from './services.js';
import { readXmlFile, xmlAttrOrChild, initXmlDropzone } from './xml-importer.js';
import { initActiveNav } from './layout.js';
import { modalManager } from './modals.js';
import {
  initModalEntry, initModalExit, initModalWaste,
  addEntryRow, removeEntryRow, confirmEntry,
  addExitRow, removeExitRow, confirmExit,
  confirmWaste,
  setPrefillProduct,
} from './movements.js';

const INVENTARIO_VIEW_NAME = 'inventario';

let inventoryChipController      = null;
let inventoryFilterEngine        = null;
let addProductRowCount           = 1;
let addExistingProductRowCount   = 0;
let currentDetailProductId       = null;
let currentDetailProductActivo   = true;
let _pendingXmlImport            = null;
const _nameCheckTimers           = {};
let   _searchDebounceTimer       = null;

// ── Persistencia de filtros ───────────────────────────────────────────────

function saveUIState() {
  if (typeof storageManager?.saveUIState !== 'function') return;
  const selectedStatuses = inventoryChipController
    ? inventoryChipController.getSelectedValues()
    : Array.from(document.querySelectorAll('.filter-chip.active'))
        .map(c => c.dataset.status)
        .filter(s => s !== '');

  storageManager.saveUIState(INVENTARIO_VIEW_NAME, {
    nombre:       document.getElementById('inventario-search')?.value || '',
    categoria_id: document.getElementById('filter-category')?.value  || '',
    area_id:      document.getElementById('filter-area')?.value      || '',
    estado:       selectedStatuses.join(','),
  });
}

function restoreUIState() {
  if (typeof storageManager?.loadUIState !== 'function') return null;
  const saved = storageManager.loadUIState(INVENTARIO_VIEW_NAME);
  if (!saved) return null;

  const searchInput     = document.getElementById('inventario-search');
  const categoryFilter  = document.getElementById('filter-category');
  const areaFilter      = document.getElementById('filter-area');

  if (searchInput    && saved.nombre       != null) searchInput.value    = String(saved.nombre);
  if (categoryFilter && saved.categoria_id != null) categoryFilter.value = String(saved.categoria_id);
  if (areaFilter     && saved.area_id      != null) areaFilter.value     = String(saved.area_id);

  return saved;
}

/** Restaura los chips de estado activos desde el valor guardado. */
function restoreStatusChips(savedEstado) {
  if (!savedEstado) return;
  const wanted = String(savedEstado).split(',').map(v => v.trim()).filter(Boolean);
  if (!wanted.length) return;

  document.querySelectorAll('.filter-chip[data-status]').forEach(chip => {
    const isActive = wanted.includes(chip.dataset.status || '');
    chip.classList.toggle('active', isActive);
    chip.setAttribute('aria-pressed', String(isActive));
  });
}

// ── Filtros activos ───────────────────────────────────────────────────────

function getApiFilters() {
  const searchInput    = document.getElementById('inventario-search');
  const categoryFilter = document.getElementById('filter-category');
  const areaFilter     = document.getElementById('filter-area');
  const showInactive   = document.getElementById('chk-show-inactive-products');

  const filters = {
    nombre:       searchInput?.value.trim()  || undefined,
    categoria_id: categoryFilter?.value      || undefined,
    area_id:      areaFilter?.value          || undefined,
  };
  if (showInactive?.checked) filters.include_inactive = true;
  return filters;
}

function applyFilters() {
  inventoryFilterEngine?.apply();
}

// ── Carga de datos ────────────────────────────────────────────────────────

/** Obtiene la lista de productos del backend y repinta la tabla. */
async function loadProductos(filters = {}) {
  try {
    store.setState({ ui: { loading: true } });
    const res   = await ProductService.getAll(filters);
    const items = res?.data?.items || [];
    store.setState({ products: items, ui: { loading: false } });
    renderTablaProductos(items);
  } catch (err) {
    store.setState({ ui: { loading: false } });
    showToast(err.message, 'error');
  }
}

// ── Helpers de catálogos ──────────────────────────────────────────────────

/** Retorna mapas id→nombre para categorías, áreas y unidades. */
function getCatalogMaps() {
  const catalogs = store.getState().catalogs || {};
  const toMap = items => Object.fromEntries((items || []).map(i => [String(i.id), i.nombre]));
  return {
    categorias: toMap(catalogs.categorias),
    areas:      toMap(catalogs.areas),
    unidades:   toMap(catalogs.unidades),
  };
}

/** Construye un `<select>` de catálogo con la opción seleccionada marcada. */
function buildCatalogSelectHTML(type, selectedValue, ariaLabel) {
  const catalogs = store.getState().catalogs || {};
  const suppliers = store.getState().suppliers || [];

  const sourceMap = { category: catalogs.categorias, area: catalogs.areas, unit: catalogs.unidades, supplier: suppliers };
  const source    = sourceMap[type] || [];
  const nameMap   = { category: 'category', area: 'area', unit: 'unit', supplier: 'supplier' };
  const phMap     = { category: 'Categoría...', area: 'Área...', unit: 'Unidad...', supplier: 'Proveedor...' };

  const selectedId = selectedValue == null ? '' : String(selectedValue);
  const options    = [`<option value="">${phMap[type] || 'Seleccionar...'}</option>`];

  source.forEach(item => {
    const id       = String(item.id);
    const selected = id === selectedId ? ' selected' : '';
    options.push(`<option value="${escapeHtml(id)}"${selected}>${escapeHtml(item.nombre)}</option>`);
  });

  return `<select name="${nameMap[type]}" class="select-native" aria-label="${escapeHtml(ariaLabel)}">${options.join('')}</select>`;
}

/** Rellena los selects de filtro de la barra superior con datos del store. */
function populateFilterDropdowns() {
  const catalogs       = store.getState().catalogs || {};
  const categoryFilter = document.getElementById('filter-category');
  const areaFilter     = document.getElementById('filter-area');

  if (categoryFilter) {
    categoryFilter.innerHTML = '<option value="">Todas las categorías</option>'
      + (catalogs.categorias || []).map(i =>
          `<option value="${escapeHtml(String(i.id))}">${escapeHtml(i.nombre)}</option>`
        ).join('');
  }
  if (areaFilter) {
    areaFilter.innerHTML = '<option value="">Todas las áreas</option>'
      + (catalogs.areas || []).map(i =>
          `<option value="${escapeHtml(String(i.id))}">${escapeHtml(i.nombre)}</option>`
        ).join('');
  }
}

// ── Renderizado principal ─────────────────────────────────────────────────

/** Pinta la tabla de productos. */
function renderTablaProductos(items) {
  const tbody = document.getElementById('inventario-tbody');
  if (!tbody) return;

  if (!items?.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-muted" style="text-align:center; padding:18px;">Sin productos registrados</td></tr>';
    applyFilters();
    return;
  }

  const maps = getCatalogMaps();

  tbody.innerHTML = items.map(item => {
    const stockActual      = Number(item.stock_actual || 0);
    const stockMin         = Number(item.stock_min    || 0);
    const statusKey        = toStatusKey(item.estado);
    const activo           = item.activo !== false && item.activo !== 0;
    const categoriaNombre  = maps.categorias[String(item.categoria_id)] || `ID ${item.categoria_id}`;
    const areaNombre       = maps.areas[String(item.area_id)]           || `ID ${item.area_id}`;
    const unidadNombre     = maps.unidades[String(item.unidad_id)]      || `ID ${item.unidad_id}`;

    const trClasses = [
      stockActual < stockMin ? 'stock-low' : '',
      !activo               ? 'tr-inactive' : '',
    ].filter(Boolean).join(' ');

    const id = escapeHtml(String(item.id));

    return `<tr${trClasses ? ` class="${trClasses}"` : ''}
        data-name="${escapeHtml(item.nombre)}"
        data-category="${escapeHtml(String(item.categoria_id))}"
        data-area="${escapeHtml(String(item.area_id))}"
        data-status="${escapeHtml(statusKey)}">
      <td>${escapeHtml(item.nombre)}</td>
      <td>${escapeHtml(categoriaNombre)}</td>
      <td>${escapeHtml(areaNombre)}</td>
      <td class="td-num${stockActual === 0 ? ' text-zero' : ''}">${stockActual}</td>
      <td class="td-num">${stockMin}</td>
      <td>${escapeHtml(unidadNombre)}</td>
      <td class="text-center">${statusBadge(item.estado)}</td>
      <td class="text-center">${activoBadge(activo)}</td>
      <td class="td-actions">
        <div class="dropdown-wrapper">
          <button class="btn btn-ghost btn-icon"
              data-action="toggle-dropdown" data-id="${id}"
              aria-haspopup="true" aria-expanded="false" aria-label="Acciones">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>
          </button>
          <div class="dropdown-menu hidden" role="menu">
            <button class="dropdown-item" role="menuitem" data-action="view-detail" data-id="${id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              Ver detalle
            </button>
            <button class="dropdown-item" role="menuitem" data-action="movement" data-tipo="entrada" data-id="${id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v13"/><path d="m5 14 7 7 7-7"/><path d="M5 21h14"/></svg>
              Registrar entrada
            </button>
            <button class="dropdown-item" role="menuitem" data-action="movement" data-tipo="salida" data-id="${id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V8"/><path d="m5 10 7-7 7 7"/><path d="M5 3h14"/></svg>
              Registrar salida
            </button>
            <button class="dropdown-item" role="menuitem" data-action="movement" data-tipo="merma" data-id="${id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              Registrar merma
            </button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  applyFilters();
}

/** Pinta el historial de movimientos dentro del modal de detalle. */
function renderHistorialEnModal(historial) {
  const tbody = document.getElementById('pd-history-tbody');
  if (!tbody) return;

  if (!historial?.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center;">Sin movimientos</td></tr>';
    return;
  }

  tbody.innerHTML = historial.map(mov => {
    const qty      = Number(mov.cantidad || 0);
    const qtyLabel = (mov.tipo === 'entrada' ? '+' : '-') + Math.abs(qty);
    const fecha    = mov.fecha_sistema ? String(mov.fecha_sistema).slice(0, 10) : '';
    const usuario  = mov.usuario_nombre || (mov.usuario_id != null ? `Usuario ID: ${mov.usuario_id}` : '-');

    return `<tr>
      <td>${escapeHtml(fecha)}</td>
      <td class="text-center">${tipoBadge(mov.tipo)}</td>
      <td class="td-num">${escapeHtml(qtyLabel)}</td>
      <td>${escapeHtml(usuario)}</td>
    </tr>`;
  }).join('');
}

// ── Modal de detalle ──────────────────────────────────────────────────────

/** Carga el detalle de un producto y abre el modal de información. */
async function openProductDetail(btn) {
  const id = btn?.dataset?.id;
  if (!id) return;

  try {
    const res      = await ProductService.getById(id);
    const data     = res?.data || {};
    const producto = data.producto  || {};
    const historial = data.historial || [];

    const maps    = getCatalogMaps();
    const stock   = Number(producto.stock_actual || 0);
    const minStock = Number(producto.stock_min   || 0);

    const setInput = (inputId, value) => {
      const el = document.getElementById(inputId);
      if (el) el.value = value == null ? '' : String(value);
    };

    setInput('pd-name',     producto.nombre || '');
    setInput('pd-category', maps.categorias[String(producto.categoria_id)] || producto.categoria_id || '');
    setInput('pd-area',     maps.areas[String(producto.area_id)]           || producto.area_id      || '');
    setInput('pd-stock',    stock);
    setInput('pd-min-stock', minStock);
    setInput('pd-unit',     maps.unidades[String(producto.unidad_id)]      || producto.unidad_id    || '');

    const pct = minStock > 0 ? Math.min(100, Math.round((stock / minStock) * 100)) : 100;
    const bar = document.getElementById('pd-progress-bar');
    if (bar) {
      bar.style.width = `${pct}%`;
      bar.setAttribute('aria-valuenow', pct);
      bar.classList.remove('success', 'warning', 'danger');
      bar.classList.add(pct <= 0 ? 'danger' : pct < 50 ? 'warning' : 'success');
    }

    const label = document.getElementById('pd-progress-label');
    if (label) label.textContent = `Stock: ${stock} / Mínimo: ${minStock}`;

    currentDetailProductId     = Number(id);
    currentDetailProductActivo = producto.activo !== false && producto.activo !== 0;

    const toggleBtn = document.getElementById('btn-toggle-product');
    if (toggleBtn) {
      if (currentDetailProductActivo) {
        toggleBtn.textContent = 'Desactivar';
        toggleBtn.classList.add('btn-outline-danger');
        toggleBtn.classList.remove('btn-outline-success');
      } else {
        toggleBtn.textContent = 'Activar';
        toggleBtn.classList.remove('btn-outline-danger');
        toggleBtn.classList.add('btn-outline-success');
      }
    }

    renderHistorialEnModal(historial);
    modalManager.open('modal-product-detail');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleProductFromDetail() {
  if (!currentDetailProductId) return;
  try {
    await ProductService.toggle(currentDetailProductId);
    const accion = currentDetailProductActivo ? 'desactivado' : 'activado';
    showToast(MSG.INVENTORY.PRODUCT_TOGGLED(accion), 'success');
    modalManager.close('modal-product-detail');
    await loadProductos(getApiFilters());
  } catch (err) {
    showToast(err?.message || MSG.INVENTORY.TOGGLE_ERROR, 'error');
  }
}

// ── Sección Agregar Producto — filas dinámicas ────────────────────────────

/** Genera el HTML interno de una fila nueva en la tabla de alta de productos. */
function createAddProductRowHTML(id, data = {}) {
  return `
    <tr data-row-id="${id}">
      <td><input type="text" name="name" class="input" placeholder="Nombre..." aria-label="Nombre del producto" value="${escapeHtml(data.name || '')}"></td>
      <td>${buildCatalogSelectHTML('category', data.categoryId,  'Categoría')}</td>
      <td>${buildCatalogSelectHTML('area',     data.areaId,      'Área')}</td>
      <td>${buildCatalogSelectHTML('unit',     data.unitId,      'Unidad de medida')}</td>
      <td>${buildCatalogSelectHTML('supplier', data.supplierId,  'Proveedor')}</td>
      <td><input type="number" name="stock"     min="0" class="input" placeholder="0" aria-label="Stock"   value="${escapeHtml(data.stock   || '')}"></td>
      <td><input type="number" name="min_stock" min="0" class="input" placeholder="0" aria-label="Mínimo" value="${escapeHtml(data.minimo  || '')}"></td>
      <td><input type="number" name="max_stock" min="0" class="input" placeholder="0" aria-label="Máximo" value="${escapeHtml(data.maximo  || '')}"></td>
      <td style="white-space:nowrap;">
        <button type="button" class="btn btn-ghost btn-icon" data-action="move-to-existing"
            title="Mover a existentes" aria-label="Mover a existentes" style="display:none;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
        <button type="button" class="btn btn-ghost btn-icon" data-action="remove-new-row"
            aria-label="Eliminar fila">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
    </tr>`;
}

function addProductRow(prefill) {
  const tbody = document.getElementById('add-product-rows');
  if (!tbody) return;

  addProductRowCount += 1;
  const tr = document.createElement('tr');
  tr.setAttribute('data-row-id', String(addProductRowCount));
  tr.innerHTML = createAddProductRowHTML(addProductRowCount, prefill || {})
    .replace(/^\s*<tr[^>]*>\n?/, '')
    .replace(/\n?\s*<\/tr>\s*$/, '');
  tbody.appendChild(tr);
  _attachNameDebounce(tr);

  const nameInput = tr.querySelector('input[name="name"]');
  const moveBtn   = tr.querySelector('[data-action="move-to-existing"]');
  if (moveBtn && nameInput?.value.trim()) moveBtn.style.display = '';

  updateNewRowsButtonStates();
}

function removeAddProductRow(id) {
  const tbody = document.getElementById('add-product-rows');
  if (!tbody || tbody.rows.length <= 1) return;

  tbody.querySelector(`[data-row-id="${id}"]`)?.remove();
  updateNewRowsButtonStates();
}

/** Vigila el campo nombre con debounce y muestra aviso si el producto ya existe. */
function _attachNameDebounce(rowEl) {
  const nameInput = rowEl.querySelector('input[name="name"]');
  if (!nameInput) return;

  const rowId = rowEl.getAttribute('data-row-id');
  nameInput.addEventListener('input', () => {
    clearTimeout(_nameCheckTimers[rowId]);
    const moveBtn = rowEl.querySelector('[data-action="move-to-existing"]');
    const name    = nameInput.value.trim();
    if (moveBtn) moveBtn.style.display = name ? '' : 'none';
    if (!name) return;

    _nameCheckTimers[rowId] = setTimeout(async () => {
      try {
        const res = await ProductService.checkName(name);
        nameInput.classList.toggle('input-warning', !!(res?.data?.exists));
        nameInput.title = res?.data?.exists ? 'Producto ya registrado' : '';
      } catch (_) {}
    }, 300);
  });
}

function updateNewRowsButtonStates() {
  const rows   = document.querySelectorAll('#add-product-rows tr');
  const single = rows.length <= 1;
  rows.forEach(row => {
    const removeBtn = row.querySelector('[data-action="remove-new-row"]');
    if (removeBtn) removeBtn.style.display = single ? 'none' : '';
  });
}

/** Verifica nombres de filas XML contra el backend y mueve los existentes. */
async function validateXmlProductNames() {
  const rows = Array.from(document.querySelectorAll('#add-product-rows tr'));
  if (!rows.length) return;

  const checks = rows.map(async row => {
    const nameInput   = row.querySelector('input[name="name"]');
    const name        = nameInput?.value.trim();
    if (!name) return null;

    const stockInput    = row.querySelector('input[name="stock"]');
    const supplierSelect = row.querySelector('select[name="supplier"]');
    const cantidad      = parseFloat(stockInput?.value) || 0;
    const supplierId    = supplierSelect?.value ? Number(supplierSelect.value) : null;

    try {
      const res = await ProductService.checkName(name);
      if (res?.data?.exists) return { row, productId: res.data.id, cantidad, supplierId };
    } catch (_) {}
    return null;
  });

  const toMove = (await Promise.all(checks)).filter(Boolean);
  if (!toMove.length) return;

  toMove.forEach(({ row, productId, cantidad, supplierId }) => {
    addExistingProductRow(productId, cantidad, supplierId);
    row.remove();
  });

  updateNewRowsButtonStates();
  const existingSection = document.getElementById('ap-section-existing');
  if (existingSection) existingSection.style.display = '';
  const collapseBtn = document.getElementById('ap-collapse-new');
  if (collapseBtn) collapseBtn.style.display = 'flex';
}

/** Genera el HTML interno de una fila de producto existente. */
function createExistingProductRowHTML(id, productId, cantidad, supplierId) {
  const products  = store.getState().products  || [];
  const suppliers = store.getState().suppliers || [];
  const maps      = getCatalogMaps();

  const productOptions = ['<option value="">Seleccionar producto...</option>']
    .concat(products.map(p => {
      const sel = String(p.id) === String(productId) ? ' selected' : '';
      return `<option value="${escapeHtml(String(p.id))}"${sel}>${escapeHtml(p.nombre)}</option>`;
    }));

  let unitName = '';
  if (productId) {
    const matched = products.find(p => String(p.id) === String(productId));
    if (matched) unitName = maps.unidades[String(matched.unidad_id)] || '';
  }

  const supplierOptions = ['<option value="">Proveedor...</option>']
    .concat(suppliers.map(s => {
      const sel = String(s.id) === String(supplierId) ? ' selected' : '';
      return `<option value="${escapeHtml(String(s.id))}"${sel}>${escapeHtml(s.nombre)}</option>`;
    }));

  return `
    <tr data-row-id="${id}">
      <td>
        <select name="product" class="select-native" aria-label="Seleccionar producto">
          ${productOptions.join('')}
        </select>
      </td>
      <td><input type="number" name="quantity" min="1" class="input" style="width:70px;" placeholder="0" aria-label="Cantidad" value="${cantidad > 0 ? cantidad : ''}"></td>
      <td><span class="text-sm text-muted" id="ap-existing-unit-${id}">${escapeHtml(unitName)}</span></td>
      <td><select name="supplier" class="select-native" aria-label="Proveedor">${supplierOptions.join('')}</select></td>
      <td style="white-space:nowrap;">
        <button type="button" class="btn btn-ghost btn-icon" data-action="move-to-new"
            title="Mover a nuevos productos" aria-label="Mover a nuevos productos">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 5-7 7 7 7"/></svg>
        </button>
        <button type="button" class="btn btn-ghost btn-icon" data-action="remove-existing-row"
            aria-label="Eliminar fila existente">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
    </tr>`;
}

function addExistingProductRow(productId, cantidad, supplierId) {
  const tbody = document.getElementById('existing-product-rows');
  if (!tbody) return;

  addExistingProductRowCount += 1;
  const id = addExistingProductRowCount;
  const tr = document.createElement('tr');
  tr.setAttribute('data-row-id', String(id));
  tr.innerHTML = createExistingProductRowHTML(id, productId, cantidad, supplierId)
    .replace(/^\s*<tr[^>]*>\n?/, '')
    .replace(/\n?\s*<\/tr>\s*$/, '');
  tbody.appendChild(tr);

  const existingSection = document.getElementById('ap-section-existing');
  if (existingSection) existingSection.style.display = '';
}

function removeExistingProductRow(id) {
  const tbody = document.getElementById('existing-product-rows');
  tbody?.querySelector(`[data-row-id="${id}"]`)?.remove();

  const existingSection = document.getElementById('ap-section-existing');
  if (existingSection && tbody && !tbody.rows.length) existingSection.style.display = 'none';
}

/** Actualiza el span de unidad al cambiar el producto seleccionado. */
function onExistingProductChange(selectEl, rowId) {
  const products  = store.getState().products || [];
  const maps      = getCatalogMaps();
  const unitSpan  = document.getElementById(`ap-existing-unit-${rowId}`);
  if (!unitSpan) return;

  const product = products.find(p => String(p.id) === String(selectEl.value));
  unitSpan.textContent = product ? (maps.unidades[String(product.unidad_id)] || '') : '';
}

// ── Mover filas entre secciones ───────────────────────────────────────────

async function moveNewToExisting(rowId) {
  const tbody = document.getElementById('add-product-rows');
  const row   = tbody?.querySelector(`[data-row-id="${rowId}"]`);
  if (!row) return;

  const nameInput      = row.querySelector('input[name="name"]');
  const stockInput     = row.querySelector('input[name="stock"]');
  const supplierSelect = row.querySelector('select[name="supplier"]');

  const name       = (nameInput?.value || '').trim();
  const cantidad   = parseFloat(stockInput?.value) || 0;
  const supplierId = supplierSelect?.value ? Number(supplierSelect.value) : null;

  let productId = null;
  if (name) {
    try {
      const res = await ProductService.checkName(name);
      productId = res?.data?.id ?? null;
    } catch (_) {}
  }

  addExistingProductRow(productId, cantidad, supplierId);

  const allNewRows = document.querySelectorAll('#add-product-rows tr');
  if (allNewRows.length <= 1) {
    if (nameInput) nameInput.value = '';
    row.querySelector('select[name="category"]').value = '';
    row.querySelector('select[name="area"]').value     = '';
    row.querySelector('select[name="unit"]').value     = '';
    const moveBtn = row.querySelector('[data-action="move-to-existing"]');
    if (moveBtn) moveBtn.style.display = 'none';
  } else {
    removeAddProductRow(rowId);
  }
}

function moveExistingToNew(rowId) {
  const tbody = document.getElementById('existing-product-rows');
  const row   = tbody?.querySelector(`[data-row-id="${rowId}"]`);
  if (!row) return;

  const select       = row.querySelector('select[name="product"]');
  const qtyInput     = row.querySelector('input[name="quantity"]');
  const supplierSel  = row.querySelector('select[name="supplier"]');

  const productId  = select ? Number(select.value) : null;
  const cantidad   = parseFloat(qtyInput?.value) || 0;
  const supplierId = supplierSel?.value ? Number(supplierSel.value) : null;

  const prefill = { stock: cantidad > 0 ? String(cantidad) : '', supplierId };
  if (productId) {
    const product = (store.getState().products || []).find(p => p.id === productId);
    if (product) {
      prefill.name       = product.nombre;
      prefill.categoryId = product.categoria_id;
      prefill.areaId     = product.area_id;
      prefill.unitId     = product.unidad_id;
    }
  }

  addProductRow(prefill);
  removeExistingProductRow(rowId);
}

// ── Colapsar/expandir secciones del modal ─────────────────────────────────

function toggleApSection(section) {
  const isNew    = section === 'new';
  const bodyId   = isNew ? 'ap-section-new-body'     : 'ap-section-existing-body';
  const labelId  = isNew ? 'ap-collapse-new-label'   : 'ap-collapse-existing-label';
  const iconId   = isNew ? 'ap-collapse-new-icon'    : 'ap-collapse-existing-icon';

  const body  = document.getElementById(bodyId);
  const label = document.getElementById(labelId);
  const icon  = document.getElementById(iconId);
  if (!body) return;

  const hidden = body.style.display === 'none';
  body.style.display        = hidden ? '' : 'none';
  if (label) label.textContent  = hidden ? 'Ocultar' : 'Mostrar';
  if (icon)  icon.style.transform = hidden ? '' : 'rotate(180deg)';
}

// ── Guardar productos (alta en lote) ──────────────────────────────────────

/** Recoge, valida y envía al backend todos los productos nuevos y existentes. */
async function saveNewProducts() {
  const payloadItems  = [];
  const movementItems = [];
  let invalid         = false;

  // Filas nuevas
  document.querySelectorAll('#add-product-rows tr').forEach(row => {
    const nameInput      = row.querySelector('input[name="name"]');
    const stockInput     = row.querySelector('input[name="stock"]');
    const minStockInput  = row.querySelector('input[name="min_stock"]');
    const maxStockInput  = row.querySelector('input[name="max_stock"]');
    const categorySelect = row.querySelector('select[name="category"]');
    const areaSelect     = row.querySelector('select[name="area"]');
    const unitSelect     = row.querySelector('select[name="unit"]');
    const supplierSelect = row.querySelector('select[name="supplier"]');

    const nombre      = nameInput?.value.trim() || '';
    const categoriaId = Number(categorySelect?.value || 0);
    const areaId      = Number(areaSelect?.value     || 0);
    const unidadId    = Number(unitSelect?.value     || 0);
    const proveedorId = supplierSelect?.value ? Number(supplierSelect.value) : null;
    const stockActual = Number(stockInput?.value  || 0);
    const stockMin    = Number(minStockInput?.value || 0);
    const stockMaxRaw = Number(maxStockInput?.value || 0);
    const stockMax    = stockMaxRaw > 0 ? stockMaxRaw : Math.max(stockMin, stockActual, 1);

    if (!nombre && !categoriaId && !areaId && !unidadId && !stockActual && !stockMin) return;

    if (!nombre || !categoriaId || !areaId || !unidadId) {
      invalid = true;
      if (nameInput     && !nombre)      nameInput.classList.add('input-error');
      if (categorySelect && !categoriaId) categorySelect.classList.add('input-error');
      if (areaSelect    && !areaId)      areaSelect.classList.add('input-error');
      if (unitSelect    && !unidadId)    unitSelect.classList.add('input-error');
      return;
    }

    payloadItems.push({ nombre, categoria_id: categoriaId, area_id: areaId, unidad_id: unidadId,
      proveedor_id: proveedorId, stock_actual: stockActual, stock_min: stockMin, stock_max: stockMax });
  });

  // Filas existentes
  document.querySelectorAll('#existing-product-rows tr').forEach(row => {
    const productSelect = row.querySelector('select[name="product"]');
    const qtyInput      = row.querySelector('input[name="quantity"]');
    const productId     = Number(productSelect?.value || 0);
    const cantidad      = parseFloat(qtyInput?.value) || 0;

    if (!productId) { invalid = true; productSelect?.classList.add('input-error'); return; }
    if (cantidad <= 0) { invalid = true; qtyInput?.classList.add('input-error'); return; }
    movementItems.push({ producto_id: productId, cantidad });
  });

  if (invalid)                                       { showToast(MSG.INVENTORY.SAVE_REQUIRED_FIELDS, 'error'); return; }
  if (!payloadItems.length && !movementItems.length) { showToast(MSG.INVENTORY.NO_VALID_PRODUCTS,    'error'); return; }

  try {
    let creados = 0, omitidos = 0;
    if (payloadItems.length) {
      const res = await ProductService.createBulk(payloadItems);
      creados   = Number(res?.data?.creados  || 0);
      omitidos  = Number(res?.data?.omitidos || 0);
    }
    if (movementItems.length) {
      await MovementService.create('entrada', movementItems, { motivo: 'Carga desde inventario' });
    }

    modalManager.close('modal-add-product');
    await loadProductos();

    const msg = [
      creados        ? `Creados: ${creados}`                              : '',
      omitidos       ? `Omitidos: ${omitidos}`                            : '',
      movementItems.length ? MSG.INVENTORY.ENTRIES_COUNT(movementItems.length) : '',
    ].filter(Boolean).join(', ');

    showToast(msg || MSG.INVENTORY.SAVED, 'success');
    document.dispatchEvent(new CustomEvent('products:changed'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Importación XML ───────────────────────────────────────────────────────

function _openXmlSupplierModal(supplierName, rows) {
  _pendingXmlImport = { rows, supplierName };
  const nameInput  = document.getElementById('xml-proveedor-nombre');
  const emailInput = document.getElementById('xml-proveedor-email');
  const telInput   = document.getElementById('xml-proveedor-telefono');
  if (nameInput)  nameInput.value  = supplierName || '';
  if (emailInput) emailInput.value = '';
  if (telInput)   telInput.value   = '';
  modalManager.open('modal-xml-proveedor');
}

async function saveXmlSupplier() {
  const nombre   = document.getElementById('xml-proveedor-nombre')?.value.trim()   || '';
  const email    = document.getElementById('xml-proveedor-email')?.value.trim()    || '';
  const telefono = document.getElementById('xml-proveedor-telefono')?.value.trim() || '';

  if (!nombre) {
    document.getElementById('xml-proveedor-nombre')?.classList.add('input-error');
    return;
  }

  try {
    await ProviderService.create({ nombre, email: email || null, telefono: telefono || null });
    const res = await ProviderService.getAll();
    if (res?.data?.items) store.setState({ suppliers: res.data.items });

    showToast(MSG.INVENTORY.SUPPLIER_ADDED(nombre), 'success');
    modalManager.close('modal-xml-proveedor');

    if (_pendingXmlImport) {
      const pendingRows    = _pendingXmlImport.rows;
      _pendingXmlImport    = null;
      fillAddProductRowsFromXml(pendingRows);
      showToast(MSG.INVENTORY.XML_LOADED_CFDI(pendingRows.length), 'success');
    }
  } catch (err) {
    showToast(err?.message || MSG.INVENTORY.SUPPLIER_ADD_ERROR, 'error');
  }
}

function skipXmlSupplier() {
  modalManager.close('modal-xml-proveedor');
  if (!_pendingXmlImport) return;
  const pendingRows = _pendingXmlImport.rows;
  _pendingXmlImport = null;
  fillAddProductRowsFromXml(pendingRows);
  showToast(MSG.INVENTORY.XML_LOADED_CFDI(pendingRows.length), 'success');
}

/** Resuelve el id de un catálogo a partir del nombre (normalizado). */
function resolveCatalogIdByName(catalogItems, name) {
  const normalized = normalizeSearch(name);
  const hit = (catalogItems || []).find(item => normalizeSearch(item.nombre) === normalized);
  return hit?.id ?? null;
}

/** Rellena las filas de nuevos productos a partir de un array de datos XML. */
function fillAddProductRowsFromXml(rows) {
  const tbody = document.getElementById('add-product-rows');
  if (!tbody) return;

  const catalogs  = store.getState().catalogs  || {};
  const suppliers = store.getState().suppliers || [];

  tbody.innerHTML  = '';
  addProductRowCount = 0;

  (rows || []).forEach(data => {
    addProductRowCount += 1;
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', String(addProductRowCount));
    tr.innerHTML = createAddProductRowHTML(addProductRowCount, {
      name:       data.name,
      categoryId: resolveCatalogIdByName(catalogs.categorias, data.category),
      areaId:     resolveCatalogIdByName(catalogs.areas,      data.area),
      unitId:     resolveCatalogIdByName(catalogs.unidades,   data.unit),
      supplierId: resolveCatalogIdByName(suppliers,           data.supplier),
      stock:      data.stock,
      minimo:     data.minimo,
      maximo:     data.maximo || '',
    }).replace(/^\s*<tr[^>]*>\n?/, '').replace(/\n?\s*<\/tr>\s*$/, '');

    tbody.appendChild(tr);
    _attachNameDebounce(tr);

    const nameInput = tr.querySelector('input[name="name"]');
    const moveBtn   = tr.querySelector('[data-action="move-to-existing"]');
    if (moveBtn && nameInput?.value.trim()) moveBtn.style.display = '';
  });

  if (addProductRowCount === 0) {
    addProductRowCount = 1;
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', '1');
    tr.innerHTML = createAddProductRowHTML(1, {})
      .replace(/^\s*<tr[^>]*>\n?/, '').replace(/\n?\s*<\/tr>\s*$/, '');
    tbody.appendChild(tr);
  }

  updateNewRowsButtonStates();
  setTimeout(() => validateXmlProductNames().catch(() => {}), 0);
}

async function importAddProductFromXml(file) {
  const { doc, error } = await readXmlFile(file);
  if (error) { showToast(error, 'error'); return; }

  const conceptoNodes = doc.querySelectorAll('cfdi\\:Concepto, Concepto');
  if (conceptoNodes.length) {
    const emisorNode        = doc.querySelector('cfdi\\:Emisor, Emisor');
    const supplierNameFromXml = emisorNode ? xmlAttrOrChild(emisorNode, 'Nombre', 'nombre') : '';

    const rows = Array.from(conceptoNodes).map(n => ({
      name:     xmlAttrOrChild(n, 'Descripcion', 'descripcion'),
      category: '',
      area:     '',
      unit:     xmlAttrOrChild(n, 'Unidad', 'ClaveUnidad', 'unidad'),
      stock:    xmlAttrOrChild(n, 'Cantidad', 'cantidad'),
      minimo:   '',
      supplier: supplierNameFromXml,
    }));

    if (supplierNameFromXml) {
      const storeSuppliers = store.getState().suppliers || [];
      const found = storeSuppliers.find(s => normalizeSearch(s.nombre) === normalizeSearch(supplierNameFromXml));
      if (!found) { _openXmlSupplierModal(supplierNameFromXml, rows); return; }
    }

    fillAddProductRowsFromXml(rows);
    showToast(MSG.INVENTORY.XML_LOADED_CFDI(rows.length), 'success');
    return;
  }

  const nodes = doc.querySelectorAll('producto, Producto, PRODUCTO');
  if (!nodes.length) { showToast(MSG.INVENTORY.XML_NO_PRODUCTS, 'error'); return; }

  const rows = Array.from(nodes).map(n => ({
    name:     xmlAttrOrChild(n, 'nombre', 'name'),
    category: xmlAttrOrChild(n, 'categoria', 'category'),
    area:     xmlAttrOrChild(n, 'area'),
    unit:     xmlAttrOrChild(n, 'unidad', 'unit'),
    stock:    xmlAttrOrChild(n, 'stock'),
    minimo:   xmlAttrOrChild(n, 'minimo', 'min'),
  }));

  fillAddProductRowsFromXml(rows);
  showToast(MSG.INVENTORY.XML_LOADED(rows.length), 'success');
}

// ── Inicialización del modal Agregar ──────────────────────────────────────

function initModalAddProduct() {
  const tbody = document.getElementById('add-product-rows');
  if (tbody) tbody.innerHTML = '';
  addProductRowCount = 0;
  addProductRow();

  const existingTbody = document.getElementById('existing-product-rows');
  if (existingTbody) existingTbody.innerHTML = '';
  addExistingProductRowCount = 0;

  const existingSection = document.getElementById('ap-section-existing');
  if (existingSection) existingSection.style.display = 'none';

  const fileName = document.getElementById('ap-xml-file-name');
  if (fileName) fileName.textContent = '';
}

function initAddProductXmlImport() {
  initXmlDropzone({
    dropzoneId: 'ap-xml-dropzone',
    inputId:    'ap-xml-input',
    btnId:      'ap-xml-btn',
    fileNameId: 'ap-xml-file-name',
    onFile:     importAddProductFromXml,
  });
}

// ── Dropdown de acciones por fila ─────────────────────────────────────────

function closeAllRowDropdowns() {
  document.querySelectorAll('.dropdown-menu[data-state="open"]').forEach(dd => {
    dd.classList.add('hidden');
    dd.dataset.state  = 'closed';
    dd.style.top      = '';
    dd.style.left     = '';
    dd.style.position = '';
  });
}

function toggleRowDropdown(event, btn) {
  event.stopPropagation();
  const menu   = btn.nextElementSibling;
  const isOpen = !menu.classList.contains('hidden');

  closeAllRowDropdowns();

  if (!isOpen) {
    const rect         = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top      = `${rect.bottom + 4}px`;
    menu.style.left     = `${rect.left}px`;
    menu.classList.remove('hidden');
    menu.dataset.state  = 'open';
    menu.style.left     = `${rect.right - menu.offsetWidth}px`;
  }
}

function openMovementFromRow(productId, tipo) {
  closeAllRowDropdowns();
  setPrefillProduct(productId);
  const modalId = tipo === 'entrada' ? 'modal-entry'
                : tipo === 'salida'  ? 'modal-exit'
                : 'modal-waste';
  modalManager.open(modalId);
}

// ── Carga de catálogos en store ───────────────────────────────────────────

async function ensureCatalogsInStore() {
  const state    = store.getState();
  const catalogs = state.catalogs || {};
  const hasAny   = (catalogs.categorias || []).length > 0
                || (catalogs.areas      || []).length > 0
                || (catalogs.unidades   || []).length > 0;

  await Promise.all([
    hasAny
      ? Promise.resolve()
      : CatalogService.getAllCatalogs()
          .then(d => store.setState({ catalogs: d }))
          .catch(() => {}),
    state.suppliers?.length
      ? Promise.resolve()
      : ProviderService.getAll()
          .then(r => { if (r?.data?.items) store.setState({ suppliers: r.data.items }); })
          .catch(() => {}),
  ]);
}

// ── Inicialización ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initActiveNav();

  // Registrar callbacks de init de modales de movimientos
  modalManager.registerInit('modal-entry', initModalEntry);
  modalManager.registerInit('modal-exit',  initModalExit);
  modalManager.registerInit('modal-waste', initModalWaste);

  // Event delegation: botones estáticos de modales
  document.getElementById('btn-add-entry-row')  ?.addEventListener('click', addEntryRow);
  document.getElementById('btn-confirm-entry')  ?.addEventListener('click', confirmEntry);
  document.getElementById('btn-add-exit-row')   ?.addEventListener('click', addExitRow);
  document.getElementById('btn-confirm-exit')   ?.addEventListener('click', confirmExit);
  document.getElementById('btn-confirm-waste')  ?.addEventListener('click', confirmWaste);

  // Event delegation: botones de eliminar fila (dinámicos)
  document.getElementById('entry-rows')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="remove"]');
    if (btn) removeEntryRow(Number(btn.closest('tr')?.dataset.rowId));
  });
  document.getElementById('exit-rows')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="remove"]');
    if (btn) removeExitRow(Number(btn.closest('tr')?.dataset.rowId));
  });

  const rawSaved = storageManager.loadUIState ? storageManager.loadUIState(INVENTARIO_VIEW_NAME) : null;
  const initialFilters = {
    nombre:       rawSaved?.nombre       || undefined,
    categoria_id: rawSaved?.categoria_id || undefined,
    area_id:      rawSaved?.area_id      || undefined,
  };
  await Promise.all([
    ensureCatalogsInStore(),
    loadProductos(initialFilters),
  ]);
  populateFilterDropdowns();
  const savedState = restoreUIState();

  // Filtros de la barra superior
  document.getElementById('inventario-search')?.addEventListener('input', () => {
    saveUIState();
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => loadProductos(getApiFilters()), 300);
  });
  document.getElementById('filter-category')?.addEventListener('change', () => {
    applyFilters();
    saveUIState();
    loadProductos(getApiFilters());
  });
  document.getElementById('filter-area')?.addEventListener('change', () => {
    applyFilters();
    saveUIState();
    loadProductos(getApiFilters());
  });
  document.getElementById('chk-show-inactive-products')?.addEventListener('change', () => {
    loadProductos(getApiFilters());
  });

  // Chips de estado
  inventoryChipController = initFilterChips({
    chipSelector:               '.filter-chip[data-status]',
    mode:                       'multi',
    datasetKey:                 'status',
    allValue:                   '',
    normalizeAllWhenAllSelected: true,
    onChange: () => { applyFilters(); saveUIState(); },
  });

  if (savedState?.estado != null) restoreStatusChips(savedState.estado);

  const statusParam = new URLSearchParams(window.location.search).get('estado');
  if (statusParam) {
    document.querySelectorAll('.filter-chip').forEach(chip => {
      if (chip.dataset.status === statusParam) chip.click();
    });
  }

  // Motor de filtrado
  inventoryFilterEngine = new FilterEngine({
    rowSelector:  '#inventario-tbody tr',
    getCriteria:  () => ({
      category:        (document.getElementById('filter-category')?.value  || '').toLowerCase(),
      area:            (document.getElementById('filter-area')?.value      || '').toLowerCase(),
      selectedStatuses: inventoryChipController
        ? inventoryChipController.getSelectedValues()
        : Array.from(document.querySelectorAll('.filter-chip.active'))
            .map(c => c.dataset.status)
            .filter(s => s !== ''),
    }),
    mapRow:       row => ({
      rowCategory: (row.dataset.category || '').toLowerCase(),
      rowArea:     (row.dataset.area     || '').toLowerCase(),
      rowStatus:   (row.dataset.status   || '').toLowerCase(),
    }),
    predicates: [
      (c, r) => !c.category         || r.rowCategory === c.category,
      (c, r) => !c.area             || r.rowArea     === c.area,
      (c, r) => !c.selectedStatuses.length || c.selectedStatuses.includes(r.rowStatus),
    ],
    setEmptyState: result => {
      const emptyMsg = document.getElementById('inventario-empty');
      if (emptyMsg) emptyMsg.style.display = result.visible === 0 ? 'block' : 'none';
    },
  });

  // Event delegation: tabla principal
  document.getElementById('inventario-tbody')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, tipo } = btn.dataset;

    if (action === 'toggle-dropdown') { toggleRowDropdown(e, btn); return; }
    if (action === 'view-detail')     { openProductDetail(btn);    return; }
    if (action === 'movement')        { openMovementFromRow(Number(id), tipo); }
  });

  // Event delegation: filas nuevas
  document.getElementById('add-product-rows')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const rowId = Number(btn.closest('tr')?.dataset.rowId);
    if (btn.dataset.action === 'move-to-existing') moveNewToExisting(rowId);
    if (btn.dataset.action === 'remove-new-row')   removeAddProductRow(rowId);
  });

  // Event delegation: filas existentes (click + change)
  const existingRowsContainer = document.getElementById('existing-product-rows');
  existingRowsContainer?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const rowId = Number(btn.closest('tr')?.dataset.rowId);
    if (btn.dataset.action === 'move-to-new')         moveExistingToNew(rowId);
    if (btn.dataset.action === 'remove-existing-row') removeExistingProductRow(rowId);
  });
  existingRowsContainer?.addEventListener('change', e => {
    const select = e.target.closest('select[name="product"]');
    if (select) onExistingProductChange(select, Number(select.closest('tr')?.dataset.rowId));
  });

  // Botones estáticos del modal de detalle
  document.getElementById('btn-toggle-product')?.addEventListener('click', toggleProductFromDetail);

  // Botones del modal de agregar producto
  document.getElementById('ap-collapse-new')     ?.addEventListener('click', () => toggleApSection('new'));
  document.getElementById('ap-collapse-existing') ?.addEventListener('click', () => toggleApSection('existing'));
  document.getElementById('btn-add-product-row') ?.addEventListener('click', () => addProductRow());
  document.getElementById('btn-save-products')   ?.addEventListener('click', saveNewProducts);

  // Botones del modal de proveedor XML
  document.getElementById('btn-skip-xml-supplier')?.addEventListener('click', skipXmlSupplier);
  document.getElementById('btn-save-xml-supplier') ?.addEventListener('click', saveXmlSupplier);

  // Inicializar primera fila del modal agregar
  const firstRow = document.querySelector('#add-product-rows tr');
  if (firstRow) {
    firstRow.setAttribute('data-row-id', '1');
    firstRow.innerHTML = createAddProductRowHTML(1, {})
      .replace(/^\s*<tr[^>]*>\n?/, '').replace(/\n?\s*<\/tr>\s*$/, '');
    _attachNameDebounce(firstRow);
  }

  document.addEventListener('movements:changed', () => loadProductos(getApiFilters()));
  document.addEventListener('products:changed',  () => loadProductos(getApiFilters()));

  applyFilters();
  saveUIState();
  initAddProductXmlImport();

  document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown-wrapper')) closeAllRowDropdowns();
  });
});
