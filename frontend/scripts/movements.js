/**
 * movements.js
 * Lógica compartida de modales de movimientos (entrada/salida/merma).
 * Usado por dashboard.js e inventario.js.
 */

// ── State ─────────────────────────────────────────────────────────────────
var _movEntryRowCount = 1;
var _movExitRowCount = 1;
var _movWasteRowCount = 1;

/**
 * Prefill global: si se asigna un ID de producto antes de abrir un modal,
 * las funciones initModal* lo pre-seleccionan automáticamente.
 */
window._movementPrefill = null;

// ── Ensure data loaded ────────────────────────────────────────────────────

async function _ensureProductsLoaded() {
  var state = window.store && window.store.getState();
  if (state && state.products && state.products.length) return;
  try {
    var res = await window.ProductService.getAll({ limit: 200 });
    if (res && res.data && res.data.items) {
      window.store.setState({ products: res.data.items });
      return;
    }
    window.store.setState({ products: [] });
  } catch (_) {
    window.store.setState({ products: [] });
  }
}

async function _ensureSuppliersLoaded() {
  var state = window.store && window.store.getState();
  if (state && state.suppliers && state.suppliers.length) return;
  try {
    var res = await window.ProviderService.getAll();
    if (res && res.data && res.data.items) {
      window.store.setState({ suppliers: res.data.items });
    }
  } catch (_) {}
}

async function _ensureCatalogsLoaded() {
  var state = window.store && window.store.getState();
  var areas = state && state.catalogs && state.catalogs.areas;
  if (areas && areas.length) return;
  try {
    var cats = await window.CatalogService.getAllCatalogs();
    if (cats) window.store.setState({ catalogs: cats });
  } catch (_) {}
}

// ── Load selects ──────────────────────────────────────────────────────────

function _loadProductsIntoSelects(container, selectName) {
  var products = (window.store && window.store.getState().products) || [];
  if (!products.length) return;
  container.querySelectorAll('select[name="' + selectName + '"]').forEach(function (sel) {
    var current = sel.value;
    sel.innerHTML = '<option value="">Seleccionar producto...</option>';
    products.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nombre || p.sku || String(p.id);
      if (String(p.id) === String(current)) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function _loadSuppliersIntoSelects(container, selectName) {
  var suppliers = (window.store && window.store.getState().suppliers) || [];
  container.querySelectorAll('select[name="' + selectName + '"]').forEach(function (sel) {
    var current = sel.value;
    sel.innerHTML = '<option value="">Proveedor...</option>';
    suppliers.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.nombre || String(s.id);
      if (String(s.id) === String(current)) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function _loadAreasIntoSelects(container, selectName) {
  var areas = (window.store && window.store.getState().catalogs.areas) || [];
  if (!areas.length) return;
  container.querySelectorAll('select[name="' + selectName + '"]').forEach(function (sel) {
    sel.innerHTML = '<option value="">Destino...</option>';
    areas.forEach(function (a) {
      var opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.nombre;
      sel.appendChild(opt);
    });
  });
}

// ── Stock listeners (exit modal) ──────────────────────────────────────────

function _bindStockListeners(container) {
  container.querySelectorAll('select[name="product"]').forEach(function (sel) {
    sel.removeEventListener('change', _onExitProductChange);
    sel.addEventListener('change', _onExitProductChange);
  });
}

function _onExitProductChange(e) {
  var row = e.target.closest('tr');
  if (!row) return;
  var stockSpan = row.querySelector('[id^="exit-stock-"]');
  if (!stockSpan) return;
  var productId = e.target.value;
  if (!productId) { stockSpan.textContent = '—'; return; }
  var products = (window.store && window.store.getState().products) || [];
  var product = products.find(function (p) { return String(p.id) === String(productId); });
  stockSpan.textContent = product ? String(product.stock_actual) : '—';
}

// ── Prefill helper ────────────────────────────────────────────────────────

function _applyMovementPrefill(modal) {
  if (!window._movementPrefill) return;
  var productId = String(window._movementPrefill);
  window._movementPrefill = null;
  var sel = modal.querySelector('select[name="product"]');
  if (sel) {
    sel.value = productId;
    sel.dispatchEvent(new Event('change'));
  }
}

// ── Entry rows ────────────────────────────────────────────────────────────

function createEntryRowHTML(id, rowData) {
  rowData = rowData || {};
  var productText = rowData.product || '';
  var qty = rowData.quantity || '';
  var unit = rowData.unit || '—';
  var supplierText = rowData.supplier || '';
  var productSelect = selectUI.buildSelectWithPlaceholder({
    name: 'product',
    ariaLabel: 'Seleccionar producto',
    width: '220px',
    placeholder: 'Seleccionar producto...',
    selectedText: productText,
  });
  var supplierSelect = selectUI.buildSelectWithPlaceholder({
    name: 'supplier',
    ariaLabel: 'Proveedor',
    width: '220px',
    placeholder: 'Proveedor...',
    selectedText: supplierText,
  });

  return '<td>' + productSelect + '</td>'
    + '<td><input type="number" name="quantity" min="1" class="input" style="width:70px;" placeholder="0" aria-label="Cantidad" value="' + escapeHtml(String(qty)) + '"></td>'
    + '<td><span class="text-sm text-muted" id="entry-unit-' + id + '">' + escapeHtml(unit) + '</span></td>'
    + '<td>' + supplierSelect + '</td>'
    + '<td><button type="button" class="btn btn-ghost btn-icon" onclick="removeEntryRow(' + id + ')" aria-label="Eliminar fila">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    + '</button></td>';
}

function addEntryRow(prefill) {
  _movEntryRowCount++;
  var tbody = document.getElementById('entry-rows');
  if (!tbody) return;
  var row = document.createElement('tr');
  row.setAttribute('data-row-id', _movEntryRowCount);
  row.innerHTML = createEntryRowHTML(_movEntryRowCount, prefill);
  tbody.appendChild(row);
  _loadProductsIntoSelects(row, 'product');
  _loadSuppliersIntoSelects(row, 'supplier');
}

function removeEntryRow(id) {
  var tbody = document.getElementById('entry-rows');
  if (!tbody || tbody.rows.length <= 1) return;
  var row = tbody.querySelector('[data-row-id="' + id + '"]');
  if (row) row.remove();
}

function _resetEntryRows() {
  var tbody = document.getElementById('entry-rows');
  if (!tbody) return;
  _movEntryRowCount = 0;
  tbody.innerHTML = '';
  addEntryRow();
  var fileName = document.getElementById('entry-xml-file-name');
  if (fileName) fileName.textContent = '';
}

// ── Exit rows ─────────────────────────────────────────────────────────────

function addExitRow() {
  _movExitRowCount++;
  var tbody = document.getElementById('exit-rows');
  if (!tbody) return;
  var productSelect = selectUI.buildSelectWithPlaceholder({
    name: 'product',
    ariaLabel: 'Seleccionar producto',
    width: '180px',
    placeholder: 'Seleccionar producto...',
  });
  var destinationSelect = selectUI.buildSelectWithPlaceholder({
    name: 'destination',
    ariaLabel: 'Destino',
    width: '160px',
    placeholder: 'Destino...',
  });
  var row = document.createElement('tr');
  row.setAttribute('data-row-id', _movExitRowCount);
  row.innerHTML = '<td>' + productSelect + '</td>'
    + '<td><input type="number" name="quantity" min="1" class="input" style="width:80px;" placeholder="0" aria-label="Cantidad"></td>'
    + '<td><span class="text-sm text-muted" id="exit-stock-' + _movExitRowCount + '">—</span></td>'
    + '<td>' + destinationSelect + '</td>'
    + '<td><button type="button" class="btn btn-ghost btn-icon" onclick="removeExitRow(' + _movExitRowCount + ')" aria-label="Eliminar fila">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    + '</button></td>';
  tbody.appendChild(row);
  _loadProductsIntoSelects(row, 'product');
  _loadAreasIntoSelects(row, 'destination');
  _bindStockListeners(row);
}

function removeExitRow(id) {
  var tbody = document.getElementById('exit-rows');
  if (!tbody || tbody.rows.length <= 1) return;
  var row = tbody.querySelector('[data-row-id="' + id + '"]');
  if (row) row.remove();
}

function _resetExitRows() {
  var tbody = document.getElementById('exit-rows');
  if (!tbody) return;
  _movExitRowCount = 0;
  tbody.innerHTML = '';
  addExitRow();
}

// ── Waste rows ────────────────────────────────────────────────────────────

function addWasteRow() {}
function removeWasteRow() {}

function _resetWasteRow() {
  var tbody = document.getElementById('waste-rows');
  if (!tbody) return;
  _movWasteRowCount = 1;
  tbody.innerHTML =
    '<tr data-row-id="1">'
    + '<td><select name="product" class="select-native" style="width:180px;" aria-label="Seleccionar producto"><option value="">Seleccionar producto...</option></select></td>'
    + '<td><input type="number" name="quantity" min="1" class="input" style="width:80px;" placeholder="0" aria-label="Cantidad"></td>'
    + '<td><select name="reason" class="select-native" style="width:180px;" aria-label="Motivo de merma">'
    + '<option value="">Seleccionar motivo...</option>'
    + '<option value="humedad">Da\u00f1o por humedad</option>'
    + '<option value="vencido">Producto vencido</option>'
    + '<option value="rotura">Rotura accidental</option>'
    + '<option value="robo">Robo o extrav\u00edo</option>'
    + '<option value="otro">Otro</option>'
    + '</select></td>'
    + '</tr>';
  var notes = document.getElementById('waste-notes');
  if (notes) notes.value = '';
}

// ── Modal init hooks (called by modalManager.open) ────────────────────────

async function initModalEntry(modal) {
  await Promise.all([_ensureProductsLoaded(), _ensureSuppliersLoaded()]);
  _resetEntryRows();
  _loadProductsIntoSelects(modal, 'product');
  _loadSuppliersIntoSelects(modal, 'supplier');
  _applyMovementPrefill(modal);
}

async function initModalExit(modal) {
  await Promise.all([_ensureProductsLoaded(), _ensureCatalogsLoaded()]);
  _resetExitRows();
  _loadProductsIntoSelects(modal, 'product');
  _loadAreasIntoSelects(modal, 'destination');
  _bindStockListeners(modal);
  _applyMovementPrefill(modal);
}

async function initModalWaste(modal) {
  await _ensureProductsLoaded();
  _resetWasteRow();
  _loadProductsIntoSelects(modal, 'product');
  _applyMovementPrefill(modal);
}

// ── Confirm handlers ──────────────────────────────────────────────────────

async function confirmEntry() {
  var tbody = document.getElementById('entry-rows');
  if (!tbody) return;
  var items = [];
  for (var i = 0; i < tbody.rows.length; i++) {
    var row = tbody.rows[i];
    var productSel = row.querySelector('select[name="product"]');
    var qtyInput   = row.querySelector('input[name="quantity"]');
    var producto_id = productSel ? parseInt(productSel.value, 10) : NaN;
    var cantidad    = qtyInput   ? parseFloat(qtyInput.value)    : NaN;
    if (!productSel || !productSel.value || isNaN(producto_id)) continue;
    if (!qtyInput   || isNaN(cantidad) || cantidad <= 0)         continue;
    items.push({ producto_id: producto_id, cantidad: cantidad });
  }
  if (!items.length) {
    showToast('Agrega al menos un producto con cantidad válida', 'error');
    return;
  }
  try {
    await window.MovementService.create('entrada', items);
    showToast('Entradas registradas correctamente', 'success');
    modalManager.close('modal-entry');
    window.store.setState({ products: [] });
    document.dispatchEvent(new CustomEvent('movements:changed'));
  } catch (err) {
    showToast((err && err.message) || 'Error al registrar entradas', 'error');
  }
}

async function confirmExit() {
  var tbody = document.getElementById('exit-rows');
  if (!tbody) return;
  var items = [];
  var area_id = null;
  for (var i = 0; i < tbody.rows.length; i++) {
    var row = tbody.rows[i];
    var productSel = row.querySelector('select[name="product"]');
    var qtyInput   = row.querySelector('input[name="quantity"]');
    var destSel    = row.querySelector('select[name="destination"]');
    var producto_id = productSel ? parseInt(productSel.value, 10) : NaN;
    var cantidad    = qtyInput   ? parseFloat(qtyInput.value)    : NaN;
    if (destSel && destSel.value) area_id = parseInt(destSel.value, 10);
    if (!productSel || !productSel.value || isNaN(producto_id)) continue;
    if (!qtyInput   || isNaN(cantidad) || cantidad <= 0)         continue;
    items.push({ producto_id: producto_id, cantidad: cantidad });
  }
  if (!items.length) {
    showToast('Agrega al menos un producto con cantidad válida', 'error');
    return;
  }
  if (!area_id) {
    showToast('Selecciona un destino (área)', 'error');
    return;
  }
  try {
    await window.MovementService.create('salida', items, { area_id: area_id });
    showToast('Salidas registradas correctamente', 'success');
    modalManager.close('modal-exit');
    window.store.setState({ products: [] });
    document.dispatchEvent(new CustomEvent('movements:changed'));
  } catch (err) {
    showToast((err && err.message) || 'Error al registrar salidas', 'error');
  }
}

async function confirmWaste() {
  var tbody = document.getElementById('waste-rows');
  if (!tbody) return;
  var items = [];
  for (var i = 0; i < tbody.rows.length; i++) {
    var row = tbody.rows[i];
    var productSel = row.querySelector('select[name="product"]');
    var qtyInput   = row.querySelector('input[name="quantity"]');
    var reasonSel  = row.querySelector('select[name="reason"]');
    var producto_id = productSel ? parseInt(productSel.value, 10) : NaN;
    var cantidad    = qtyInput   ? parseFloat(qtyInput.value)    : NaN;
    var motivo      = reasonSel  ? reasonSel.value               : '';
    if (!productSel || !productSel.value || isNaN(producto_id)) continue;
    if (!qtyInput   || isNaN(cantidad) || cantidad <= 0)         continue;
    if (!motivo) {
      showToast('Selecciona un motivo para cada fila de merma', 'error');
      return;
    }
    items.push({ producto_id: producto_id, cantidad: cantidad, motivo: motivo });
  }
  if (!items.length) {
    showToast('Agrega al menos un producto con cantidad y motivo válidos', 'error');
    return;
  }
  try {
    await window.MovementService.create('merma', items);
    showToast('Merma registrada correctamente', 'success');
    modalManager.close('modal-waste');
    window.store.setState({ products: [] });
    document.dispatchEvent(new CustomEvent('movements:changed'));
  } catch (err) {
    showToast((err && err.message) || 'Error al registrar merma', 'error');
  }
}
