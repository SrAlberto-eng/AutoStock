/**
 * inventario.js
 * Carga inventario real desde backend, renderiza tabla dinámica,
 * abre detalle por API y crea productos en lote.
 */

let inventoryChipController = null;
let inventoryFilterEngine = null;
let addProductRowCount = 1;
let currentDetailProductId = null;
let currentDetailProductActivo = true;
const INVENTARIO_VIEW_NAME = 'inventario';

function saveInventarioUIState() {
  if (!window.storageManager || typeof window.storageManager.saveUIState !== 'function') return;

  const searchInput = document.getElementById('inventario-search');
  const categoryFilter = document.getElementById('filter-category');
  const areaFilter = document.getElementById('filter-area');
  const selectedStatuses = inventoryChipController
    ? inventoryChipController.getSelectedValues()
    : Array.from(document.querySelectorAll('.filter-chip.active'))
        .map(function (chip) { return chip.dataset.status; })
        .filter(function (status) { return status !== ''; });

  window.storageManager.saveUIState(INVENTARIO_VIEW_NAME, {
    nombre: searchInput ? searchInput.value || '' : '',
    categoria_id: categoryFilter ? categoryFilter.value || '' : '',
    area_id: areaFilter ? areaFilter.value || '' : '',
    estado: selectedStatuses.join(','),
  });
}

function restoreInventarioUIState() {
  if (!window.storageManager || typeof window.storageManager.loadUIState !== 'function') return null;

  const saved = window.storageManager.loadUIState(INVENTARIO_VIEW_NAME);
  if (!saved) return null;

  const searchInput = document.getElementById('inventario-search');
  const categoryFilter = document.getElementById('filter-category');
  const areaFilter = document.getElementById('filter-area');

  if (searchInput && saved.nombre != null) searchInput.value = String(saved.nombre);
  if (categoryFilter && saved.categoria_id != null) categoryFilter.value = String(saved.categoria_id);
  if (areaFilter && saved.area_id != null) areaFilter.value = String(saved.area_id);

  return saved;
}

function applySavedInventarioEstado(savedEstado) {
  if (!savedEstado) return;

  const normalized = String(savedEstado).trim().toLowerCase();
  let forcedStatus = '';
  if (normalized === 'agotado') forcedStatus = 'agotado';
  if (normalized === 'poca existencia') forcedStatus = 'bajo_minimo';

  if (!forcedStatus) return;

  const chips = Array.from(document.querySelectorAll('.filter-chip[data-status]'));
  chips.forEach(function (chip) {
    const isActive = (chip.dataset.status || '') === forcedStatus;
    chip.classList.toggle('active', isActive);
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function getInventarioApiFilters() {
  const categoryFilter = document.getElementById('filter-category');
  const areaFilter = document.getElementById('filter-area');
  const showInactive = document.getElementById('chk-show-inactive-products');
  var filters = {
    categoria_id: categoryFilter && categoryFilter.value ? categoryFilter.value : undefined,
    area_id: areaFilter && areaFilter.value ? areaFilter.value : undefined,
  };
  if (showInactive && showInactive.checked) {
    filters.include_inactive = true;
  }
  return filters;
}

function normalizeText(value) {
  return (value == null ? '' : String(value)).trim().toLowerCase();
}

function toStatusKey(estado) {
  const normalized = normalizeText(estado);
  if (normalized === 'agotado') return 'agotado';
  if (normalized === 'poca existencia') return 'bajo_minimo';
  return 'normal';
}

function statusBadge(estado) {
  const key = toStatusKey(estado);
  if (key === 'agotado') {
    return '<span class="badge badge-danger">Agotado</span>';
  }
  if (key === 'bajo_minimo') {
    return '<span class="badge badge-warning">Bajo mínimo</span>';
  }
  return '<span class="badge badge-success">Normal</span>';
}

function escapeHtmlSafe(value) {
  if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
  const str = value == null ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCatalogMaps() {
  const catalogs = window.store.getState().catalogs || {};
  const toMap = function (items) {
    const map = {};
    (items || []).forEach(function (item) {
      map[String(item.id)] = item.nombre;
    });
    return map;
  };

  return {
    categorias: toMap(catalogs.categorias),
    areas: toMap(catalogs.areas),
    unidades: toMap(catalogs.unidades),
  };
}

function buildCatalogSelectHTML(type, selectedValue, ariaLabel) {
  const catalogs = window.store.getState().catalogs || {};
  const suppliers = (window.store.getState().suppliers) || [];
  const source = type === 'category'
    ? (catalogs.categorias || [])
    : type === 'area'
      ? (catalogs.areas || [])
      : type === 'supplier'
        ? suppliers
        : (catalogs.unidades || []);

  const name = type === 'category' ? 'category'
    : type === 'area' ? 'area'
    : type === 'supplier' ? 'supplier'
    : 'unit';
  const selectedId = selectedValue == null ? '' : String(selectedValue);

  let placeholder = 'Seleccionar...';
  if (type === 'category') placeholder = 'Categoría...';
  if (type === 'area') placeholder = 'Área...';
  if (type === 'unit') placeholder = 'Unidad...';
  if (type === 'supplier') placeholder = 'Proveedor...';

  const options = ['<option value="">' + placeholder + '</option>'];
  source.forEach(function (item) {
    const id = String(item.id);
    const selected = id === selectedId ? ' selected' : '';
    options.push('<option value="' + escapeHtmlSafe(id) + '"' + selected + '>' + escapeHtmlSafe(item.nombre) + '</option>');
  });

  return '<select name="' + name + '" class="select-native" aria-label="' + escapeHtmlSafe(ariaLabel) + '">' + options.join('') + '</select>';
}

function populateFilterDropdownsFromStore() {
  const catalogs = window.store.getState().catalogs || {};
  const categoryFilter = document.getElementById('filter-category');
  const areaFilter = document.getElementById('filter-area');

  if (categoryFilter) {
    const opts = ['<option value="">Todas las categorías</option>'];
    (catalogs.categorias || []).forEach(function (item) {
      opts.push('<option value="' + escapeHtmlSafe(String(item.id)) + '">' + escapeHtmlSafe(item.nombre) + '</option>');
    });
    categoryFilter.innerHTML = opts.join('');
  }

  if (areaFilter) {
    const opts = ['<option value="">Todas las áreas</option>'];
    (catalogs.areas || []).forEach(function (item) {
      opts.push('<option value="' + escapeHtmlSafe(String(item.id)) + '">' + escapeHtmlSafe(item.nombre) + '</option>');
    });
    areaFilter.innerHTML = opts.join('');
  }
}

function applyFilters() {
  if (inventoryFilterEngine) inventoryFilterEngine.apply();
}

async function loadProductos(filters = {}) {
  try {
    window.store.setState({ ui: { loading: true } });
    const res = await window.ProductService.getAll(filters);
    const items = (res && res.data && res.data.items) ? res.data.items : [];
    window.store.setState({ products: items, ui: { loading: false } });
    renderTablaProductos(items);
  } catch (err) {
    window.store.setState({ ui: { loading: false } });
    showToast(err.message, 'error');
  }
}

function renderTablaProductos(items) {
  const tbody = document.getElementById('inventario-tbody');
  if (!tbody) return;

  const maps = getCatalogMaps();

  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#A6A6A6; padding:18px;">Sin productos registrados</td></tr>';
    applyFilters();
    return;
  }

  const rows = items.map(function (item) {
    const stockActual = Number(item.stock_actual || 0);
    const stockMin = Number(item.stock_min || 0);
    const statusKey = toStatusKey(item.estado);
    const isLowStock = stockActual < stockMin;
    const activo = item.activo !== false && item.activo !== 0;
    const categoriaNombre = maps.categorias[String(item.categoria_id)] || ('ID ' + item.categoria_id);
    const areaNombre = maps.areas[String(item.area_id)] || ('ID ' + item.area_id);
    const unidadNombre = maps.unidades[String(item.unidad_id)] || ('ID ' + item.unidad_id);

    var trClasses = [];
    if (isLowStock) trClasses.push('stock-low');
    if (!activo) trClasses.push('tr-inactive');
    var trStyle = '';

    return [
      '<tr',
      trClasses.length ? ' class="' + trClasses.join(' ') + '"' : '',
      trStyle,
      ' data-name="', escapeHtmlSafe(item.nombre),
      '" data-category="', escapeHtmlSafe(String(item.categoria_id)),
      '" data-area="', escapeHtmlSafe(String(item.area_id)),
      '" data-status="', escapeHtmlSafe(statusKey),
      '">',
      '<td>', escapeHtmlSafe(item.nombre), '</td>',
      '<td>', escapeHtmlSafe(categoriaNombre), '</td>',
      '<td>', escapeHtmlSafe(areaNombre), '</td>',
      '<td class="td-num"', stockActual === 0 ? ' style="color:#FF6B6B;"' : '', '>', escapeHtmlSafe(String(stockActual)), '</td>',
      '<td class="td-num">', escapeHtmlSafe(String(stockMin)), '</td>',
      '<td>', escapeHtmlSafe(unidadNombre), '</td>',
      '<td class="text-center">', statusBadge(item.estado), '</td>',
      '<td class="text-center">', activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-muted">Inactivo</span>', '</td>',
      '<td class="td-actions">',
      '<div class="dropdown-wrapper">',
      '<button class="btn btn-ghost btn-icon" onclick="toggleRowDropdown(event,this)" data-id="', escapeHtmlSafe(String(item.id)), '" aria-haspopup="true" aria-expanded="false" aria-label="Acciones">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>',
      '</button>',
      '<div class="dropdown-menu hidden" role="menu">',
      '<button class="dropdown-item" role="menuitem" onclick="openProductDetail(this)" data-id="', escapeHtmlSafe(String(item.id)), '">',
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
      'Ver detalle</button>',
      '<button class="dropdown-item" role="menuitem" onclick="openMovementFromRow(', escapeHtmlSafe(String(item.id)), ',\'entrada\')">',
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v13"/><path d="m5 14 7 7 7-7"/><path d="M5 21h14"/></svg>',
      'Registrar entrada</button>',
      '<button class="dropdown-item" role="menuitem" onclick="openMovementFromRow(', escapeHtmlSafe(String(item.id)), ',\'salida\')">',
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V8"/><path d="m5 10 7-7 7 7"/><path d="M5 3h14"/></svg>',
      'Registrar salida</button>',
      '<button class="dropdown-item" role="menuitem" onclick="openMovementFromRow(', escapeHtmlSafe(String(item.id)), ',\'merma\')">',
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
      'Registrar merma</button>',
      '</div>',
      '</div>',
      '</td>',
      '</tr>'
    ].join('');
  });

  tbody.innerHTML = rows.join('');
  applyFilters();
}

function renderHistorialEnModal(historial) {
  const tbody = document.getElementById('pd-history-tbody');
  if (!tbody) return;

  if (!historial || historial.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#A6A6A6;">Sin movimientos</td></tr>';
    return;
  }

  tbody.innerHTML = historial.map(function (mov) {
    const tipo = normalizeText(mov.tipo);
    let badgeClass = 'badge-primary';
    if (tipo === 'entrada') badgeClass = 'badge-success';
    if (tipo === 'merma') badgeClass = 'badge-danger';

    const qty = Number(mov.cantidad || 0);
    const qtyLabel = (tipo === 'entrada' ? '+' : '-') + Math.abs(qty);
    const fecha = mov.fecha_sistema ? String(mov.fecha_sistema).slice(0, 10) : '';
    const usuario = mov.usuario_id != null ? 'Usuario #' + mov.usuario_id : '-';

    return '<tr>' +
      '<td>' + escapeHtmlSafe(fecha) + '</td>' +
      '<td class="text-center"><span class="badge ' + badgeClass + '">' + escapeHtmlSafe(mov.tipo || '') + '</span></td>' +
      '<td class="td-num">' + escapeHtmlSafe(qtyLabel) + '</td>' +
      '<td>' + escapeHtmlSafe(usuario) + '</td>' +
      '</tr>';
  }).join('');
}

async function openProductDetail(btn) {
  const id = btn && btn.dataset ? btn.dataset.id : null;
  if (!id) return;

  try {
    const res = await window.ProductService.getById(id);
    const data = res && res.data ? res.data : {};
    const producto = data.producto || {};
    const historial = data.historial || [];

    const maps = getCatalogMaps();
    const stock = Number(producto.stock_actual || 0);
    const minStock = Number(producto.stock_min || 0);

    const setInput = function (inputId, value) {
      const el = document.getElementById(inputId);
      if (el) el.value = value == null ? '' : String(value);
    };

    setInput('pd-name', producto.nombre || '');
    setInput('pd-category', maps.categorias[String(producto.categoria_id)] || producto.categoria_id || '');
    setInput('pd-area', maps.areas[String(producto.area_id)] || producto.area_id || '');
    setInput('pd-stock', stock);
    setInput('pd-min-stock', minStock);
    setInput('pd-unit', maps.unidades[String(producto.unidad_id)] || producto.unidad_id || '');

    const pct = minStock > 0 ? Math.min(100, Math.round((stock / minStock) * 100)) : 100;
    const bar = document.getElementById('pd-progress-bar');
    if (bar) {
      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', pct);
      bar.style.background = pct <= 0 ? '#FF6B6B' : pct < 50 ? '#FFB86B' : '#6BE89A';
    }

    const label = document.getElementById('pd-progress-label');
    if (label) label.textContent = 'Stock: ' + stock + ' / Mínimo: ' + minStock;

    currentDetailProductId = Number(id);
    currentDetailProductActivo = producto.activo !== false && producto.activo !== 0;

    var toggleBtn = document.getElementById('btn-toggle-product');
    if (toggleBtn) {
      if (currentDetailProductActivo) {
        toggleBtn.textContent = 'Desactivar';
        toggleBtn.style.color = '#FF6B6B';
        toggleBtn.style.borderColor = '#FF6B6B';
      } else {
        toggleBtn.textContent = 'Activar';
        toggleBtn.style.color = '#4ADE80';
        toggleBtn.style.borderColor = '#4ADE80';
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
    await window.ProductService.toggle(currentDetailProductId);
    var accion = currentDetailProductActivo ? 'desactivado' : 'activado';
    showToast('Producto ' + accion, 'success');
    modalManager.close('modal-product-detail');
    await loadProductos(getInventarioApiFilters());
  } catch (err) {
    var msg = (err && err.message) ? err.message : 'Error al cambiar estado';
    showToast(msg, 'error');
  }
}

function createAddProductRowHTML(id, data) {
  const source = data || {};

  return [
    '<tr data-row-id="', id, '">',
    '<td><input type="text" name="name" class="input" placeholder="Nombre..." aria-label="Nombre del producto" value="', escapeHtmlSafe(source.name || ''), '"></td>',
    '<td>', buildCatalogSelectHTML('category', source.categoryId, 'Categoría'), '</td>',
    '<td>', buildCatalogSelectHTML('area', source.areaId, 'Área'), '</td>',
    '<td>', buildCatalogSelectHTML('unit', source.unitId, 'Unidad de medida'), '</td>',
    '<td>', buildCatalogSelectHTML('supplier', source.supplierId, 'Proveedor'), '</td>',
    '<td><input type="number" name="stock" min="0" class="input" placeholder="0" aria-label="Stock" value="', escapeHtmlSafe(source.stock || ''), '"></td>',
    '<td><input type="number" name="min_stock" min="0" class="input" placeholder="0" aria-label="Mínimo" value="', escapeHtmlSafe(source.minimo || ''), '"></td>',
    '<td><input type="number" name="max_stock" min="0" class="input" placeholder="0" aria-label="Máximo" value="', escapeHtmlSafe(source.maximo || ''), '"></td>',
    '<td><button type="button" class="btn btn-ghost btn-icon" onclick="removeAddProductRow(', id, ')" aria-label="Eliminar fila">',
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    '</button></td>',
    '</tr>'
  ].join('');
}

function addProductRow(prefill) {
  const tbody = document.getElementById('add-product-rows');
  if (!tbody) return;

  addProductRowCount += 1;
  const row = document.createElement('tr');
  row.setAttribute('data-row-id', String(addProductRowCount));
  row.innerHTML = createAddProductRowHTML(addProductRowCount, prefill || {})
    .replace(/^\s*<tr[^>]*>/, '')
    .replace(/<\/tr>\s*$/, '');
  tbody.appendChild(row);
}

function removeAddProductRow(id) {
  const tbody = document.getElementById('add-product-rows');
  if (!tbody || tbody.rows.length <= 1) return;

  const row = tbody.querySelector('[data-row-id="' + id + '"]');
  if (row) row.remove();
}

function resolveCatalogIdByName(catalogItems, name) {
  const normalized = normalizeText(name);
  const hit = (catalogItems || []).find(function (item) {
    return normalizeText(item.nombre) === normalized;
  });
  return hit ? hit.id : null;
}

function fillAddProductRowsFromXml(rows) {
  const tbody = document.getElementById('add-product-rows');
  if (!tbody) return;

  const catalogs = window.store.getState().catalogs || {};

  tbody.innerHTML = '';
  addProductRowCount = 0;

  (rows || []).forEach(function (data) {
    addProductRowCount += 1;
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', String(addProductRowCount));

    const suppliers = window.store.getState().suppliers || [];
    const hydrated = {
      name: data.name,
      categoryId: resolveCatalogIdByName(catalogs.categorias, data.category),
      areaId: resolveCatalogIdByName(catalogs.areas, data.area),
      unitId: resolveCatalogIdByName(catalogs.unidades, data.unit),
      supplierId: resolveCatalogIdByName(suppliers, data.supplier),
      stock: data.stock,
      minimo: data.minimo,
      maximo: data.maximo || '',
    };

    tr.innerHTML = createAddProductRowHTML(addProductRowCount, hydrated)
      .replace(/^\s*<tr[^>]*>\n?/, '')
      .replace(/\n?\s*<\/tr>\s*$/, '');
    tbody.appendChild(tr);
  });

  if (addProductRowCount === 0) {
    addProductRowCount = 1;
    tbody.innerHTML = createAddProductRowHTML(1, {});
  }
}

async function importAddProductFromXml(file) {
  const result = await readXmlFile(file);
  const doc = result.doc;
  const error = result.error;

  if (error) {
    showToast(error, 'error');
    return;
  }

  // Try CFDI format first (cfdi:Concepto or Concepto from SAT invoices)
  var conceptoNodes = doc.querySelectorAll('cfdi\\:Concepto, Concepto');
  if (conceptoNodes.length) {
    const rows = Array.from(conceptoNodes).map(function (n) {
      return {
        name: xmlAttrOrChild(n, 'Descripcion', 'descripcion'),
        category: '',
        area: '',
        unit: xmlAttrOrChild(n, 'Unidad', 'ClaveUnidad', 'unidad'),
        stock: xmlAttrOrChild(n, 'Cantidad', 'cantidad'),
        minimo: '',
      };
    });
    fillAddProductRowsFromXml(rows);
    showToast(rows.length + ' producto(s) importado(s) desde CFDI XML', 'success');
    return;
  }

  // Fallback: generic XML format (<producto> nodes)
  const nodes = doc.querySelectorAll('producto, Producto, PRODUCTO');
  if (!nodes.length) {
    showToast('No se encontraron productos ni conceptos en el XML', 'error');
    return;
  }

  const rows = Array.from(nodes).map(function (n) {
    return {
      name: xmlAttrOrChild(n, 'nombre', 'name'),
      category: xmlAttrOrChild(n, 'categoria', 'category'),
      area: xmlAttrOrChild(n, 'area'),
      unit: xmlAttrOrChild(n, 'unidad', 'unit'),
      stock: xmlAttrOrChild(n, 'stock'),
      minimo: xmlAttrOrChild(n, 'minimo', 'min'),
    };
  });

  fillAddProductRowsFromXml(rows);
  showToast(rows.length + ' producto(s) importado(s) desde XML', 'success');
}

function initModalAddProduct() {
  var tbody = document.getElementById('add-product-rows');
  if (tbody) tbody.innerHTML = '';
  addProductRowCount = 0;
  addProductRow();
  var fileName = document.getElementById('ap-xml-file-name');
  if (fileName) fileName.textContent = '';
}

function initAddProductXmlImport() {
  initXmlDropzone({
    dropzoneId: 'ap-xml-dropzone',
    inputId: 'ap-xml-input',
    btnId: 'ap-xml-btn',
    fileNameId: 'ap-xml-file-name',
    onFile: importAddProductFromXml,
  });
}

function slugifyName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function saveNewProducts() {
  const rows = Array.from(document.querySelectorAll('#add-product-rows tr'));
  const payloadItems = [];
  let invalid = false;

  rows.forEach(function (row, index) {
    const nameInput = row.querySelector('input[name="name"]');
    const stockInput = row.querySelector('input[name="stock"]');
    const minStockInput = row.querySelector('input[name="min_stock"]');
    const maxStockInput = row.querySelector('input[name="max_stock"]');
    const categorySelect = row.querySelector('select[name="category"]');
    const areaSelect = row.querySelector('select[name="area"]');
    const unitSelect = row.querySelector('select[name="unit"]');
    const supplierSelect = row.querySelector('select[name="supplier"]');

    const nombre = nameInput ? nameInput.value.trim() : '';
    const categoriaId = categorySelect ? Number(categorySelect.value || 0) : 0;
    const areaId = areaSelect ? Number(areaSelect.value || 0) : 0;
    const unidadId = unitSelect ? Number(unitSelect.value || 0) : 0;
    const proveedorId = supplierSelect && supplierSelect.value ? Number(supplierSelect.value) : null;
    const stockActual = Number(stockInput && stockInput.value ? stockInput.value : 0);
    const stockMin = Number(minStockInput && minStockInput.value ? minStockInput.value : 0);
    const stockMaxRaw = maxStockInput && maxStockInput.value ? Number(maxStockInput.value) : 0;
    const stockMax = stockMaxRaw > 0 ? stockMaxRaw : Math.max(stockMin, stockActual, 1);

    const rowIsEmpty = !nombre && !categoriaId && !areaId && !unidadId && !stockActual && !stockMin;
    if (rowIsEmpty) return;

    if (!nombre || !categoriaId || !areaId || !unidadId) {
      invalid = true;
      if (nameInput && !nombre) nameInput.style.borderColor = '#FF6B6B';
      if (categorySelect && !categoriaId) categorySelect.style.borderColor = '#FF6B6B';
      if (areaSelect && !areaId) areaSelect.style.borderColor = '#FF6B6B';
      if (unitSelect && !unidadId) unitSelect.style.borderColor = '#FF6B6B';
      return;
    }

    payloadItems.push({
      nombre: nombre,
      categoria_id: categoriaId,
      area_id: areaId,
      unidad_id: unidadId,
      proveedor_id: proveedorId,
      stock_actual: stockActual,
      stock_min: stockMin,
      stock_max: stockMax,
    });
  });

  if (invalid) {
    showToast('Completa los campos obligatorios de cada fila', 'error');
    return;
  }

  if (payloadItems.length === 0) {
    showToast('No hay productos válidos para guardar', 'error');
    return;
  }

  try {
    const res = await window.ProductService.createBulk(payloadItems);
    const data = res && res.data ? res.data : {};
    const creados = Number(data.creados || 0);
    const omitidos = Number(data.omitidos || 0);

    modalManager.close('modal-add-product');
    await loadProductos();
    showToast('Carga masiva completada. Creados: ' + creados + ', omitidos: ' + omitidos, 'success');

    // Notificar a otras vistas que los productos cambiaron
    document.dispatchEvent(new CustomEvent('products:changed'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function ensureCatalogsInStore() {
  const state = window.store.getState();
  const catalogs = state.catalogs || {};

  const hasAny =
    (catalogs.categorias || []).length > 0 ||
    (catalogs.areas || []).length > 0 ||
    (catalogs.unidades || []).length > 0;

  if (!hasAny) {
    try {
      const catalogsData = await window.CatalogService.getAllCatalogs();
      window.store.setState({ catalogs: catalogsData });
    } catch (_) {}
  }

  // Also load suppliers for the proveedor select
  if (!(state.suppliers && state.suppliers.length)) {
    try {
      var res = await window.ProviderService.getAll();
      if (res && res.data && res.data.items) {
        window.store.setState({ suppliers: res.data.items });
      }
    } catch (_) {}
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  initActiveNav();

  await ensureCatalogsInStore();
  populateFilterDropdownsFromStore();
  const savedInventarioState = restoreInventarioUIState();

  const searchInput = document.getElementById('inventario-search');
  const categoryFilter = document.getElementById('filter-category');
  const areaFilter = document.getElementById('filter-area');

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      applyFilters();
      saveInventarioUIState();
    });
  }
  if (categoryFilter) {
    categoryFilter.addEventListener('change', function () {
      applyFilters();
      saveInventarioUIState();
      loadProductos(getInventarioApiFilters());
    });
  }
  if (areaFilter) {
    areaFilter.addEventListener('change', function () {
      applyFilters();
      saveInventarioUIState();
      loadProductos(getInventarioApiFilters());
    });
  }

  var showInactiveChk = document.getElementById('chk-show-inactive-products');
  if (showInactiveChk) {
    showInactiveChk.addEventListener('change', function () {
      loadProductos(getInventarioApiFilters());
    });
  }

  inventoryChipController = initFilterChips({
    chipSelector: '.filter-chip[data-status]',
    mode: 'multi',
    datasetKey: 'status',
    allValue: '',
    normalizeAllWhenAllSelected: true,
    onChange: function () {
      applyFilters();
      saveInventarioUIState();
    },
  });

  if (savedInventarioState && savedInventarioState.estado != null) {
    applySavedInventarioEstado(savedInventarioState.estado);
  }

  const params = new URLSearchParams(window.location.search);
  const statusParam = params.get('estado');
  if (statusParam) {
    document.querySelectorAll('.filter-chip').forEach(function (chip) {
      if (chip.dataset.status === statusParam) chip.click();
    });
  }

  inventoryFilterEngine = new FilterEngine({
    rowSelector: '#inventario-tbody tr',
    getCriteria: function () {
      return {
        searchVal: (document.getElementById('inventario-search').value || '').trim().toLowerCase(),
        category: (document.getElementById('filter-category').value || '').toLowerCase(),
        area: (document.getElementById('filter-area').value || '').toLowerCase(),
        selectedStatuses: inventoryChipController
          ? inventoryChipController.getSelectedValues()
          : Array.from(document.querySelectorAll('.filter-chip.active'))
              .map(function (chip) { return chip.dataset.status; })
              .filter(function (status) { return status !== ''; }),
      };
    },
    mapRow: function (row) {
      return {
        rowName: (row.dataset.name || '').toLowerCase(),
        rowCategory: (row.dataset.category || '').toLowerCase(),
        rowArea: (row.dataset.area || '').toLowerCase(),
        rowStatus: (row.dataset.status || '').toLowerCase(),
      };
    },
    predicates: [
      function (criteria, rowData) {
        return !criteria.searchVal || rowData.rowName.includes(criteria.searchVal);
      },
      function (criteria, rowData) {
        return !criteria.category || rowData.rowCategory === criteria.category;
      },
      function (criteria, rowData) {
        return !criteria.area || rowData.rowArea === criteria.area;
      },
      function (criteria, rowData) {
        return criteria.selectedStatuses.length === 0 || criteria.selectedStatuses.includes(rowData.rowStatus);
      },
    ],
    setEmptyState: function (result) {
      const emptyMsg = document.getElementById('inventario-empty');
      if (emptyMsg) emptyMsg.style.display = result.visible === 0 ? 'block' : 'none';
    },
  });

  const firstRow = document.querySelector('#add-product-rows tr');
  if (firstRow) {
    firstRow.innerHTML = createAddProductRowHTML(1, {}).replace(/^\s*<tr[^>]*>/, '').replace(/<\/tr>\s*$/, '');
  }

  await loadProductos(getInventarioApiFilters());
  saveInventarioUIState();
  initAddProductXmlImport();

  // Refrescar tabla al registrar un movimiento desde el dropdown
  document.addEventListener('movements:changed', function () {
    loadProductos(getInventarioApiFilters());
  });
});

// ── Dropdown de acciones por fila ─────────────────────────────────────────

function toggleRowDropdown(event, btn) {
  event.stopPropagation();
  var menu = btn.nextElementSibling;
  var isOpen = !menu.classList.contains('hidden');
  // Cierra todos los dropdowns de fila abiertos
  document.querySelectorAll('.dropdown-menu[data-state="open"]').forEach(function (dd) {
    dd.classList.add('hidden');
    dd.dataset.state = 'closed';
    dd.style.top = '';
    dd.style.left = '';
    dd.style.position = '';
  });
  if (!isOpen) {
    var rect = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = (rect.right - menu.offsetWidth || rect.left) + 'px';
    menu.classList.remove('hidden');
    menu.dataset.state = 'open';
    // Ajustar left ahora que el menu ya tiene dimensiones
    menu.style.left = (rect.right - menu.offsetWidth) + 'px';
  }
}

function openMovementFromRow(productId, type) {
  document.querySelectorAll('.dropdown-menu[data-state="open"]').forEach(function (dd) {
    dd.classList.add('hidden');
    dd.dataset.state = 'closed';
    dd.style.top = '';
    dd.style.left = '';
    dd.style.position = '';
  });
  window._movementPrefill = productId;
  var modalId = type === 'entrada' ? 'modal-entry'
              : type === 'salida'  ? 'modal-exit'
              : 'modal-waste';
  modalManager.open(modalId);
}
