/**
 * catalogos.js
 * Gestión de catálogos: tabs (Categorías/Unidades/Áreas),
 * modal de crear/editar con campos dinámicos según tipo,
 * y confirmación de eliminación via AlertDialog.
 */

// Fila pendiente de eliminación
let pendingDeleteRow = null;
var proveedoresData = []; 
var pendingToggleId = null;

document.addEventListener('DOMContentLoaded', () => {
  initActiveNav();

  // Page tabs (Categorías / Unidades / Áreas / Proveedores)
  document.querySelectorAll('.tab-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('aria-controls');
      if (!targetId) return;

      document.querySelectorAll('.tab-trigger').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
        p.setAttribute('aria-hidden', 'true');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panel = document.getElementById(targetId);
      if (panel) {
        panel.classList.add('active');
        panel.style.display = 'block';
        panel.setAttribute('aria-hidden', 'false');
      }
    });
  });

  var chkInactive = document.getElementById('chk-show-inactive-proveedores');
  if (chkInactive) {
    chkInactive.addEventListener('change', function () { loadProveedores(); });
  }
  var btnToggle = document.getElementById('btn-confirm-toggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', function () { executeToggle(); });
  }

  loadCatalogos();
  loadProveedores();
});

function mapModalTypeToApiType(type) {
  const typeMap = {
    categoria: 'categorias',
    area: 'areas',
    unidad: 'unidades'
  };
  return typeMap[type] || type;
}

function mapApiTypeToModalType(type) {
  const typeMap = {
    categorias: 'categoria',
    areas: 'area',
    unidades: 'unidad'
  };
  return typeMap[type] || type;
}

function readItemId(item) {
  return item.id || item.catalogo_id || item.categoria_id || item.area_id || item.unidad_id || '';
}

function renderActionsCell(ariaLabelEdit, ariaLabelDelete) {
  return '<td class="catalog-actions td-actions">'
    + '<button class="btn btn-ghost btn-icon" onclick="editCatalogItem(this)" aria-label="' + ariaLabelEdit + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>'
    + '<button class="btn btn-ghost btn-icon" style="color:#FF6B6B;" onclick="confirmDelete(this)" aria-label="' + ariaLabelDelete + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>'
    + '</td>';
}

function renderTabla(tipo, items) {
  const tbody = document.getElementById(tipo + '-tbody');
  if (!tbody) return;

  const modalType = mapApiTypeToModalType(tipo);
  const safeItems = Array.isArray(items)
    ? items.filter(function (item) { return item && typeof item === 'object'; })
    : [];

  tbody.innerHTML = safeItems.map(item => {
    const id = window.escapeHtml(readItemId(item));
    const nombre = window.escapeHtml(item.nombre || '');
    const descripcion = window.escapeHtml(item.descripcion || '');
    const abreviatura = window.escapeHtml(item.abreviatura || item.abreviacion || '');
    const productosAsociados = window.escapeHtml(item.productos_asociados || item.productos_count || 0);

    const rowStart = '<tr data-id="' + id + '" data-tipo="' + modalType + '" data-item-id="' + id + '" data-type="' + modalType + '" data-name="' + nombre + '" data-description="' + descripcion + '" data-abbreviation="' + abreviatura + '">';

    if (tipo === 'categorias') {
      return rowStart
        + '<td>' + nombre + '</td>'
        + '<td class="td-num">' + productosAsociados + '</td>'
        + renderActionsCell('Editar categoría', 'Eliminar categoría')
        + '</tr>';
    }

    if (tipo === 'unidades') {
      return rowStart
        + '<td>' + nombre + '</td>'
        + '<td>' + abreviatura + '</td>'
        + renderActionsCell('Editar', 'Eliminar')
        + '</tr>';
    }

    return rowStart
      + '<td>' + nombre + '</td>'
      + renderActionsCell('Editar', 'Eliminar')
      + '</tr>';
  }).join('');
}

async function loadCatalogos() {
  try {
    store.setState({ ui: { loading: true } });
    const data = await window.CatalogService.getAllCatalogs();
    store.setState({ catalogs: data, ui: { loading: false } });
    renderTabla('categorias', data.categorias);
    renderTabla('areas', data.areas);
    renderTabla('unidades', data.unidades);
  } catch (err) {
    store.setState({ ui: { loading: false } });
    const msg = err && err.message ? err.message : 'Error cargando catálogos';
    showToast(msg, 'error');
  }
}

// ── Open catalog modal (new) ───────────────────────────────────────────────
function openCatalogModal(type) {
  clearCatalogModal();
  document.getElementById('catalog-type').value = type;
  setModalFieldsForType(type, false);

  const titles = { categoria: 'Nueva categoría', unidad: 'Nueva unidad de medida', area: 'Nueva área' };
  document.getElementById('modal-catalog-title').textContent = titles[type] || 'Nueva entrada';

  modalManager.open('modal-catalog');
}

// ── Open catalog modal (edit) ──────────────────────────────────────────────
function editCatalogItem(btn) {
  const row = btn.closest('tr');
  if (!row) return;

  const type = row.dataset.type || '';
  clearCatalogModal();
  document.getElementById('catalog-type').value = type;
  document.getElementById('catalog-editing-id').value = row.dataset.itemId || '';
  setModalFieldsForType(type, true);

  document.getElementById('catalog-name').value = row.dataset.name || '';
  if (type === 'categoria') document.getElementById('catalog-description').value = row.dataset.description || '';
  if (type === 'unidad')    document.getElementById('catalog-abbreviation').value = row.dataset.abbreviation || '';

  const titles = { categoria: 'Editar categoría', unidad: 'Editar unidad', area: 'Editar área' };
  document.getElementById('modal-catalog-title').textContent = titles[type] || 'Editar entrada';

  modalManager.open('modal-catalog');
}

// Show/hide fields based on catalog type
function setModalFieldsForType(type, editing) {
  document.getElementById('field-catalog-description').style.display   = type === 'categoria' ? 'block' : 'none';
  document.getElementById('field-catalog-abbreviation').style.display  = type === 'unidad' ? 'block' : 'none';
}

// ── Save catalog item ──────────────────────────────────────────────────────
async function saveCatalogItem() {
  const name = document.getElementById('catalog-name').value.trim();
  const type = document.getElementById('catalog-type').value;
  const id = document.getElementById('catalog-editing-id').value;
  const abbreviation = document.getElementById('catalog-abbreviation').value.trim();

  if (!name) {
    showToast('El nombre es requerido', 'error');
    document.getElementById('catalog-name').focus();
    return;
  }

  const apiType = mapModalTypeToApiType(type);
  const isEditing = !!id;
  const payload = { nombre: name };
  if (apiType === 'unidades') {
    payload.abreviacion = abbreviation;
  }

  try {
    store.setState({ ui: { loading: true } });

    if (isEditing) {
      await window.CatalogService.update(apiType, id, payload);
    } else {
      await window.CatalogService.create(apiType, payload);
    }

    const updated = await window.CatalogService.getAllCatalogs();
    store.setState({ catalogs: updated });
    renderTabla('categorias', updated.categorias);
    renderTabla('areas', updated.areas);
    renderTabla('unidades', updated.unidades);

    showToast('Guardado', 'success');
    modalManager.close('modal-catalog');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    store.setState({ ui: { loading: false } });
  }
}

// ── Confirm delete ─────────────────────────────────────────────────────────
function confirmDelete(btn) {
  const row = btn.closest('tr');
  if (!row) return;
  pendingDeleteRow = row;
  const name = row.dataset.name || 'este elemento';
  document.getElementById('dialog-delete-name').textContent = ` "${name}" `;
  modalManager.open('dialog-confirm-delete');
}

async function executeDelete() {
  if (!pendingDeleteRow) {
    modalManager.close('dialog-confirm-delete');
    return;
  }

  const row = pendingDeleteRow;
  const name = row.dataset.name || 'elemento';
  const type = row.dataset.tipo || row.dataset.type || '';
  const id = row.dataset.id || row.dataset.itemId || '';
  const apiType = mapModalTypeToApiType(type);

  try {
    store.setState({ ui: { loading: true } });
    await window.CatalogService.remove(apiType, id);

    row.style.transition = 'opacity 200ms ease';
    row.style.opacity = '0';
    setTimeout(() => {
      row.remove();
    }, 200);

    const updated = await window.CatalogService.getAllCatalogs();
    store.setState({ catalogs: updated });
    renderTabla('categorias', updated.categorias);
    renderTabla('areas', updated.areas);
    renderTabla('unidades', updated.unidades);

    showToast('"' + name + '" eliminado correctamente', 'success');
    modalManager.close('dialog-confirm-delete');
    pendingDeleteRow = null;
  } catch (err) {
    if (err.status === 409) {
      showToast('No se puede eliminar: tiene productos asociados', 'error');
    } else {
      showToast(err.message, 'error');
    }
  } finally {
    store.setState({ ui: { loading: false } });
  }
}

// ── Clear modal ────────────────────────────────────────────────────────────
function clearCatalogModal() {
  ['catalog-editing-id', 'catalog-name', 'catalog-description', 'catalog-abbreviation'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVEEDORES CRUD (integrated from proveedores.js)
// ═══════════════════════════════════════════════════════════════════════════

async function loadProveedores() {
  try {
    store.setState({ ui: { loading: true } });
    var chk = document.getElementById('chk-show-inactive-proveedores');
    var includeInactive = chk && chk.checked;
    var res = await window.ProviderService.getAll(includeInactive);
    var items = (res && res.data && res.data.items) ? res.data.items : [];
    proveedoresData = items;
    renderProveedores(items);
  } catch (err) {
    var msg = (err && err.message) ? err.message : 'Error cargando proveedores';
    showToast(msg, 'error');
  } finally {
    store.setState({ ui: { loading: false } });
  }
}

function renderProveedores(items) {
  var tbody = document.getElementById('proveedores-tbody');
  if (!tbody) return;

  var safeItems = Array.isArray(items)
    ? items.filter(function (item) { return item && typeof item === 'object'; })
    : [];

  if (safeItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#A6A6A6; padding:32px 0;">No hay proveedores registrados</td></tr>';
    return;
  }

  tbody.innerHTML = safeItems.map(function (item) {
    var id = window.escapeHtml(String(item.id || ''));
    var nombre = window.escapeHtml(item.nombre || '');
    var email = window.escapeHtml(item.email || '');
    var telefono = window.escapeHtml(item.telefono || '');
    var activo = item.activo !== false && item.activo !== 0;
    var productos = window.escapeHtml(String(item.productos_asociados || 0));
    var badgeClass = activo ? 'badge-success' : 'badge-muted';
    var badgeText = activo ? 'Activo' : 'Inactivo';
    var toggleIcon = activo
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    var toggleLabel = activo ? 'Desactivar proveedor' : 'Activar proveedor';
    var rowStyle = activo ? '' : ' style="opacity:0.55;"';

    return '<tr data-id="' + id + '" data-nombre="' + nombre + '"' + rowStyle + '>'
      + '<td>' + nombre + '</td>'
      + '<td>' + email + '</td>'
      + '<td>' + telefono + '</td>'
      + '<td class="text-center"><span class="badge ' + badgeClass + '">' + badgeText + '</span></td>'
      + '<td class="td-num">' + productos + '</td>'
      + '<td class="td-actions">'
      +   '<button class="btn btn-ghost btn-icon" onclick="editProveedor(' + id + ')" aria-label="Editar proveedor">'
      +     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>'
      +   '</button>'
      +   '<button class="btn btn-ghost btn-icon" onclick="confirmToggle(' + id + ')" aria-label="' + toggleLabel + '">'
      +     toggleIcon
      +   '</button>'
      + '</td>'
      + '</tr>';
  }).join('');
}

function openProveedorModal() {
  document.getElementById('proveedor-editing-id').value = '';
  document.getElementById('proveedor-nombre').value = '';
  document.getElementById('proveedor-email').value = '';
  document.getElementById('proveedor-telefono').value = '';
  document.getElementById('modal-proveedor-title').textContent = 'Nuevo proveedor';
  modalManager.open('modal-proveedor');
  setTimeout(function () { document.getElementById('proveedor-nombre').focus(); }, 100);
}

function editProveedor(id) {
  var item = proveedoresData.find(function (p) { return p.id === id; });
  if (!item) return;
  document.getElementById('proveedor-editing-id').value = String(id);
  document.getElementById('proveedor-nombre').value = item.nombre || '';
  document.getElementById('proveedor-email').value = item.email || '';
  document.getElementById('proveedor-telefono').value = item.telefono || '';
  document.getElementById('modal-proveedor-title').textContent = 'Editar proveedor';
  modalManager.open('modal-proveedor');
  setTimeout(function () { document.getElementById('proveedor-nombre').focus(); }, 100);
}

async function saveProveedor() {
  var nombre = document.getElementById('proveedor-nombre').value.trim();
  var email = document.getElementById('proveedor-email').value.trim();
  var telefono = document.getElementById('proveedor-telefono').value.trim();
  var id = document.getElementById('proveedor-editing-id').value;

  if (!nombre) {
    showToast('El nombre es requerido', 'error');
    document.getElementById('proveedor-nombre').focus();
    return;
  }

  try {
    store.setState({ ui: { loading: true } });
    if (id) {
      await window.ProviderService.update(parseInt(id, 10), { nombre: nombre, email: email, telefono: telefono});
      showToast('Proveedor actualizado', 'success');
    } else {
      await window.ProviderService.create({ nombre: nombre, email: email, telefono: telefono });
      showToast('Proveedor creado', 'success');
    }
    modalManager.close('modal-proveedor');
    await loadProveedores();
  } catch (err) {
    var msg = (err && err.response && err.response.data && err.response.data.error)
      ? err.response.data.error
      : (err && err.message) ? err.message : 'Error al guardar';
    showToast(msg, 'error');
  } finally {
    store.setState({ ui: { loading: false } });
  }
}

function confirmToggle(id) {
  var item = proveedoresData.find(function (p) { return p.id === id; });
  if (!item) return;
  pendingToggleId = id;
  var activo = item.activo !== false && item.activo !== 0;
  var nombre = window.escapeHtml(item.nombre || '');
  var title = document.getElementById('dialog-toggle-title');
  var desc = document.getElementById('dialog-toggle-desc');
  if (activo) {
    title.textContent = 'Desactivar proveedor';
    title.style.color = '#FF6B6B';
    desc.innerHTML = '¿Desactivar al proveedor <strong style="color:#E6E6E6;">"' + nombre + '"</strong>? No aparecerá en listas de selección.';
  } else {
    title.textContent = 'Activar proveedor';
    title.style.color = '#4ADE80';
    desc.innerHTML = '¿Reactivar al proveedor <strong style="color:#E6E6E6;">"' + nombre + '"</strong>?';
  }
  modalManager.open('dialog-confirm-toggle');
}

async function executeToggle() {
  if (!pendingToggleId) {
    modalManager.close('dialog-confirm-toggle');
    return;
  }
  var id = pendingToggleId;
  pendingToggleId = null;
  try {
    store.setState({ ui: { loading: true } });
    await window.ProviderService.toggle(id);
    modalManager.close('dialog-confirm-toggle');
    showToast('Estado actualizado', 'success');
    await loadProveedores();
  } catch (err) {
    var msg = (err && err.message) ? err.message : 'Error al cambiar estado';
    showToast(msg, 'error');
  } finally {
    store.setState({ ui: { loading: false } });
  }
}
