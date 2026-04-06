/**
 * dashboard.js
 * Lógica específica del dashboard: carga de tarjetas, movimientos recientes,
 * importación XML y actualización al registrar movimientos.
 *
 * La lógica de modales de movimientos (entrada/salida/merma) vive en movements.js.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Marcar nav activo
  initActiveNav();

  // Cargar datos reales del dashboard
  loadDashboard();

  // Escuchar evento de movimiento registrado (desde movements.js)
  document.addEventListener('movements:changed', loadDashboard);
  // Escuchar evento de producto creado/actualizado (desde inventario.js)
  document.addEventListener('products:changed', loadDashboard);

  // Inicializar XML import y datetime del modal de entrada
  initEntryXmlImport();
  setEntryCurrentDateTime();

  // Forzar filtro destino de inventario desde tarjetas de alertas.
  document.querySelectorAll('a[href^="inventario.html?estado="]').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      const href = link.getAttribute('href') || '';
      const estadoMatch = href.match(/estado=([^&]+)/);
      const estadoParam = estadoMatch ? decodeURIComponent(estadoMatch[1]) : '';
      const estadoDeseado = estadoParam === 'agotado' ? 'Agotado' : 'Poca existencia';

      if (window.storageManager && typeof window.storageManager.saveUIState === 'function') {
        const prev = (typeof window.storageManager.loadUIState === 'function')
          ? (window.storageManager.loadUIState('inventario') || {})
          : {};

        window.storageManager.saveUIState('inventario', Object.assign({}, prev, {
          estado: estadoDeseado
        }));
      }

      window.location.href = 'inventario.html';
    });
  });
});

// ── Entry XML import (específico del dashboard) ───────────────────────────

function setEntryCurrentDateTime() {
  const el = document.getElementById('entry-current-datetime');
  if (!el) return;
  const now = new Date();
  const formatted = now.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  el.textContent = formatted;
}

function initEntryXmlImport() {
  initXmlDropzone({
    dropzoneId : 'entry-xml-dropzone',
    inputId    : 'entry-xml-input',
    btnId      : 'entry-xml-btn',
    fileNameId : 'entry-xml-file-name',
    onFile     : importEntryFromXml,
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function () {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    reader.onerror = function () {
      reject(new Error('No se pudo leer el archivo XML'));
    };
    reader.readAsDataURL(file);
  });
}

function populateEntryProductSelect(select, products, selectedId) {
  if (!select) return;

  const currentId = selectedId == null ? '' : String(selectedId);
  select.innerHTML = '<option value="">Seleccionar producto...</option>';

  products.forEach(function (product) {
    const option = document.createElement('option');
    option.value = String(product.id);
    option.textContent = product.nombre || product.sku || ('Producto #' + product.id);
    if (option.value === currentId) option.selected = true;
    select.appendChild(option);
  });
}

function updateEntryUnitLabel(row, product) {
  if (!row || !product) return;

  const unitLabel = row.querySelector('[id^="entry-unit-"]');
  if (!unitLabel) return;

  const units = (window.store && window.store.getState().catalogs.unidades) || [];
  const unit = units.find(function (item) {
    return String(item.id) === String(product.unidad_id);
  });

  unitLabel.textContent = unit ? unit.nombre : '—';
}

function renderImportPreview(previewRows) {
  const tbody = document.getElementById('entry-rows');
  if (!tbody) return;

  const products = (window.store && window.store.getState().products) || [];
  if (!products.length) return;

  const rows = Array.from(tbody.querySelectorAll('tr'));
  let autoMatched = 0;

  rows.forEach(function (row, index) {
    const select = row.querySelector('select[name="product"]');
    if (!select) return;

    const previewLine = Array.isArray(previewRows) ? previewRows[index] : null;
    const matches = previewLine && Array.isArray(previewLine.matches)
      ? previewLine.matches
      : previewLine && Array.isArray(previewLine.sugerencias)
        ? previewLine.sugerencias
        : [];
    const bestMatch = matches.length ? matches[0] : null;

    populateEntryProductSelect(select, products, '');

    if (!bestMatch || Number(bestMatch.confianza || 0) < 0.85) {
      if (bestMatch && bestMatch.nombre_bd) {
        row.title = 'Sugerencia: ' + bestMatch.nombre_bd + ' (' + Math.round(Number(bestMatch.confianza || 0) * 100) + '%)';
      }
      return;
    }

    const product = products.find(function (item) {
      return String(item.id) === String(bestMatch.producto_id);
    });

    if (!product) return;

    select.value = String(product.id);
    updateEntryUnitLabel(row, product);
    row.dataset.previewMatched = 'true';
    row.title = 'Autoseleccionado: ' + (product.nombre || product.sku || ('Producto #' + product.id));
    autoMatched += 1;
  });

  if (autoMatched > 0) {
    showToast('Se aplicaron ' + autoMatched + ' sugerencia(s) automáticas.', 'success');
  } else {
    showToast('Sin coincidencias automáticas. Completa manualmente.', 'info');
  }
}

async function handleXmlPreview(productosParseados, xmlBase64) {
  if (!xmlBase64 || !productosParseados || !productosParseados.length) return;

  try {
    await Promise.all([_ensureProductsLoaded(), _ensureCatalogsLoaded()]);
    showToast('Consultando sugerencias...', 'info', 2000);

    const res = await window.MovementService.previewImport(xmlBase64);
    const preview = res && res.data
      ? (res.data.lineas || res.data.productos || [])
      : [];

    renderImportPreview(preview);
  } catch (err) {
    showToast('Sugerencias no disponibles. Completa manualmente.', 'info');
  }
}

async function importEntryFromXml(file) {
  const [result, xmlBase64] = await Promise.all([
    readXmlFile(file),
    readFileAsBase64(file).catch(function () { return ''; })
  ]);
  const doc = result.doc;
  const error = result.error;
  if (error) { showToast(error, 'error'); return; }

  const conceptoNodes = doc.querySelectorAll('cfdi\\:Concepto, Concepto');
  if (!conceptoNodes.length) {
    showToast('No se encontraron conceptos en el XML', 'error');
    return;
  }

  const emisor = doc.querySelector('cfdi\\:Emisor, Emisor');
  const supplierName = emisor ? xmlAttrOrChild(emisor, 'Nombre', 'nombre') : '';

  const rows = Array.from(conceptoNodes).map(node => ({
    product  : xmlAttrOrChild(node, 'Descripcion', 'descripcion'),
    quantity : xmlAttrOrChild(node, 'Cantidad', 'cantidad'),
    unit     : xmlAttrOrChild(node, 'Unidad', 'ClaveUnidad', 'unidad'),
    supplier : supplierName,
  }));

  fillEntryRowsFromXml(rows);
  showToast(`XML cargado: ${rows.length} concepto(s)`, 'success');
  await handleXmlPreview(rows, xmlBase64);
}

function fillEntryRowsFromXml(rows) {
  const tbody = document.getElementById('entry-rows');
  if (!tbody) return;

  tbody.innerHTML = '';
  _movEntryRowCount = 0;

  rows.forEach((r) => {
    addEntryRow({
      product: r.product || '',
      quantity: r.quantity || '',
      unit: r.unit || '—',
      supplier: r.supplier || ''
    });
  });

  if (!rows.length) addEntryRow();
}

// escapeHtml está definido en xml-importer.js

// ── Dashboard data loading ──────────────────────────────────────────────────

async function loadDashboard() {
  // Primero asegurar que los productos estén cargados (necesario para movimientos recientes)
  await _ensureProductsLoaded();
  // Luego cargar el resto en paralelo
  await Promise.allSettled([
    _loadSummaryCards(),
    _loadRecentMovements(),
  ]);
}

async function _loadSummaryCards() {
  try {
    const res = await window.MovementService.getDashboardSummary();
    if (!res || !res.data) return;
    const d = res.data;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (val !== undefined && val !== null) ? val : '—';
    };
    set('stat-entradas-hoy', d.entradas_hoy);
    set('stat-salidas-hoy',  d.salidas_hoy);
    const products = window.store && window.store.getState().products;
    set('stat-productos-total', products ? products.length : '—');

    const esc = (value) => {
      if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const alertCards = document.querySelectorAll('.alerts-grid .card');
    const agotadosWrap = alertCards[0] ? alertCards[0].querySelector('.space-y-3') : null;
    const bajoMinWrap = alertCards[1] ? alertCards[1].querySelector('.space-y-3') : null;

    if (agotadosWrap) {
      const agotados = Array.isArray(d.lista_agotados) ? d.lista_agotados : [];
      agotadosWrap.innerHTML = '';

      if (!agotados.length) {
        const msg = document.createElement('p');
        msg.className = 'text-sm text-muted';
        msg.style.padding = '8px 0';
        msg.textContent = 'Sin productos agotados';
        agotadosWrap.appendChild(msg);
      } else {
        agotados.forEach((item) => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.justifyContent = 'space-between';
          row.style.padding = '8px 0';
          row.style.borderBottom = '1px solid #1E2022';

          const left = document.createElement('div');
          left.style.display = 'flex';
          left.style.alignItems = 'center';
          left.style.gap = '12px';

          const dot = document.createElement('span');
          dot.style.width = '8px';
          dot.style.height = '8px';
          dot.style.borderRadius = '50%';
          dot.style.backgroundColor = '#FF6B6B';

          const info = document.createElement('div');
          const name = document.createElement('p');
          name.className = 'text-sm';
          name.style.color = '#E6E6E6';
          name.textContent = item && item.nombre ? String(item.nombre) : '';

          info.appendChild(name);
          left.appendChild(dot);
          left.appendChild(info);
          row.appendChild(left);
          agotadosWrap.appendChild(row);
        });
      }
    }

    if (bajoMinWrap) {
      const bajoMin = Array.isArray(d.lista_bajo_minimo) ? d.lista_bajo_minimo : [];
      bajoMinWrap.innerHTML = '';

      if (!bajoMin.length) {
        const msg = document.createElement('p');
        msg.className = 'text-sm text-muted';
        msg.style.padding = '8px 0';
        msg.textContent = 'Todos los productos tienen stock suficiente';
        bajoMinWrap.appendChild(msg);
      } else {
        bajoMin.forEach((item, index) => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.justifyContent = 'space-between';
          row.style.padding = '8px 0';
          if (index < bajoMin.length - 1) row.style.borderBottom = '1px solid #1E2022';

          const left = document.createElement('div');
          left.style.display = 'flex';
          left.style.alignItems = 'center';
          left.style.gap = '12px';

          const dot = document.createElement('span');
          dot.style.width = '8px';
          dot.style.height = '8px';
          dot.style.borderRadius = '50%';
          dot.style.backgroundColor = '#FFB86B';

          const info = document.createElement('div');
          const name = document.createElement('p');
          name.className = 'text-sm';
          name.style.color = '#E6E6E6';
          name.textContent = item && item.nombre ? String(item.nombre) : '';

          const stock = document.createElement('p');
          stock.className = 'text-xs text-muted';
          const actual = item && item.stock_actual != null ? item.stock_actual : 0;
          const minimo = item && item.stock_min != null ? item.stock_min : 0;
          stock.textContent = 'Stock: ' + actual + ' / Mín: ' + minimo;

          info.appendChild(name);
          info.appendChild(stock);
          left.appendChild(dot);
          left.appendChild(info);
          row.appendChild(left);
          bajoMinWrap.appendChild(row);
        });
      }
    }
  } catch (_) {}
}

async function _loadRecentMovements() {
  const list = document.getElementById('list-movimientos-recientes');
  if (!list) return;

  const setFallback = function () {
    list.innerHTML = '<p class="text-sm text-muted" style="padding:8px 0;">Sin movimientos recientes</p>';
  };

  try {
    const res = await window.MovementService.getAll({ limit: 5 });
    if (!res || !res.data || !res.data.items) {
      setFallback();
      return;
    }
    const items = res.data.items;
    if (!items.length) {
      setFallback();
      return;
    }
    const colors = { entrada: '#6BE89A', salida: '#5AA9FF', merma: '#FF6B6B' };
    const products = (window.store && window.store.getState().products) || [];
    list.innerHTML = items.map(function (m) {
      const sign  = m.tipo === 'entrada' ? '+' : '-';
      const color = colors[m.tipo] || '#E6E6E6';
      const prod  = products.find(function (p) { return p.id === m.producto_id; });
      const nombre = m.producto_nombre || (prod ? (prod.nombre || prod.sku || ('Producto #' + m.producto_id)) : ('Producto #' + m.producto_id));
      const fecha   = new Date(m.fecha_sistema);
      const diffMin = Math.round((Date.now() - fecha.getTime()) / 60000);
      const tiempo  = diffMin < 1    ? 'Ahora'
                    : diffMin < 60   ? 'Hace ' + diffMin + ' min'
                    : diffMin < 1440 ? 'Hace ' + Math.round(diffMin / 60) + ' h'
                    : fecha.toLocaleDateString('es-MX');
      return '<div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid #1E2022;">'
        + '<div style="display:flex; align-items:center; gap:12px;">'
        + '<div class="movement-dot" style="background-color:' + color + ';" aria-label="' + m.tipo + '"></div>'
        + '<div>'
        + '<p class="text-sm" style="color:#E6E6E6;">' + escapeHtml(nombre) + '</p>'
        + '<p class="text-xs text-muted">' + sign + m.cantidad + '</p>'
        + '</div>'
        + '</div>'
        + '<span class="text-xs text-muted">' + tiempo + '</span>'
        + '</div>';
    }).join('');
  } catch (_) {
    setFallback();
  }
}
