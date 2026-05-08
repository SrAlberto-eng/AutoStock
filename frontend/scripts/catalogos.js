/**
 * catalogos.js
 * Gestión de catálogos: tabs Categorías / Unidades / Áreas / Proveedores.
 * Modal crear/editar genérico + confirmación de eliminación y toggle de proveedor.
 */
import { MSG }        from './constants/messages.js';
import { activoBadge } from './ui-helpers.js';

/** Fila pendiente de eliminación mientras se muestra el AlertDialog. */
let pendingDeleteRow = null;
/** ID del proveedor pendiente de toggle. */
let pendingToggleId  = null;
/** Cache local de proveedores para edición sin viaje al servidor. */
let proveedoresData  = [];

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES INTERNAS
// ═══════════════════════════════════════════════════════════════════════════

/** Mapeo modal-type → API-type (singular → plural). */
const MODAL_TO_API = { categoria: 'categorias', area: 'areas', unidad: 'unidades' };
/** Mapeo API-type → modal-type. */
const API_TO_MODAL = { categorias: 'categoria', areas: 'area', unidades: 'unidad' };

const toApiType   = t => MODAL_TO_API[t] || t;
const toModalType = t => API_TO_MODAL[t] || t;

/**
 * Extrae el id de un ítem de catálogo con cualquiera de sus posibles claves.
 * @param {object} item
 */
function readItemId(item) {
  return item.id || item.catalogo_id || item.categoria_id
      || item.area_id || item.unidad_id || '';
}

// ═══════════════════════════════════════════════════════════════════════════
// CATÁLOGOS — CRUD (Categorías / Unidades / Áreas)
// ═══════════════════════════════════════════════════════════════════════════

// ── Renderizado ───────────────────────────────────────────────────────────

/** SVG de lápiz para el botón editar. */
const ICON_EDIT   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';
/** SVG de papelera para el botón eliminar. */
const ICON_DELETE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

/**
 * Genera las celdas de acción (editar / eliminar) para una fila de catálogo.
 * @param {string} editLabel  - aria-label del botón editar.
 * @param {string} deleteLabel - aria-label del botón eliminar.
 */
function renderActionsCell(editLabel, deleteLabel) {
  return '<td class="catalog-actions td-actions">'
    + `<button class="btn btn-ghost btn-icon" data-action="edit" aria-label="${editLabel}">${ICON_EDIT}</button>`
    + `<button class="btn btn-ghost btn-icon text-danger" data-action="delete" aria-label="${deleteLabel}">${ICON_DELETE}</button>`
    + '</td>';
}

/**
 * Pinta la tabla del tipo de catálogo indicado.
 * @param {'categorias'|'unidades'|'areas'} tipo
 * @param {object[]} items
 */
function renderTabla(tipo, items) {
  const tbody = document.getElementById(tipo + '-tbody');
  if (!tbody) return;

  const modalType = toModalType(tipo);
  const safeItems = Array.isArray(items)
    ? items.filter(i => i && typeof i === 'object')
    : [];

  tbody.innerHTML = safeItems.map(item => {
    const id           = window.escapeHtml(String(readItemId(item)));
    const nombre       = window.escapeHtml(item.nombre || '');
    const descripcion  = window.escapeHtml(item.descripcion  || '');
    const abreviatura  = window.escapeHtml(item.abreviatura || item.abreviacion || '');
    const productos    = window.escapeHtml(String(item.productos_asociados || item.productos_count || 0));

    const rowAttrs = `data-id="${id}" data-tipo="${modalType}" data-item-id="${id}"
      data-type="${modalType}" data-name="${nombre}" data-description="${descripcion}"
      data-abbreviation="${abreviatura}"`;

    if (tipo === 'categorias') {
      return `<tr ${rowAttrs}><td>${nombre}</td><td class="td-num">${productos}</td>${renderActionsCell('Editar categoría', 'Eliminar categoría')}</tr>`;
    }
    if (tipo === 'unidades') {
      return `<tr ${rowAttrs}><td>${nombre}</td><td>${abreviatura}</td>${renderActionsCell('Editar unidad', 'Eliminar unidad')}</tr>`;
    }
    return `<tr ${rowAttrs}><td>${nombre}</td>${renderActionsCell('Editar área', 'Eliminar área')}</tr>`;
  }).join('');
}

// ── Carga ─────────────────────────────────────────────────────────────────

async function loadCatalogos() {
  try {
    store.setState({ ui: { loading: true } });
    const data = await window.CatalogService.getAllCatalogs();
    store.setState({ catalogs: data, ui: { loading: false } });
    renderTabla('categorias', data.categorias);
    renderTabla('areas',      data.areas);
    renderTabla('unidades',   data.unidades);
  } catch (err) {
    store.setState({ ui: { loading: false } });
    showToast(err?.message || 'Error cargando catálogos', 'error');
  }
}

// ── Modal crear / editar ──────────────────────────────────────────────────

const CATALOG_TITLES_NEW  = { categoria: 'Nueva categoría',       unidad: 'Nueva unidad de medida', area: 'Nueva área'  };
const CATALOG_TITLES_EDIT = { categoria: 'Editar categoría',      unidad: 'Editar unidad',          area: 'Editar área' };

/** Abre el modal de catálogo vacío para crear un nuevo elemento. */
function openCatalogModal(type) {
  clearCatalogModal();
  document.getElementById('catalog-type').value = type;
  setModalFieldsForType(type);
  document.getElementById('modal-catalog-title').textContent = CATALOG_TITLES_NEW[type] || 'Nueva entrada';
  modalManager.open('modal-catalog');
}

/** Abre el modal de catálogo relleno para editar la fila indicada. */
function editCatalogItem(btn) {
  const row = btn.closest('tr');
  if (!row) return;

  const type = row.dataset.type || '';
  clearCatalogModal();
  document.getElementById('catalog-type').value      = type;
  document.getElementById('catalog-editing-id').value = row.dataset.itemId || '';
  setModalFieldsForType(type);

  document.getElementById('catalog-name').value = row.dataset.name || '';
  if (type === 'categoria') document.getElementById('catalog-description').value  = row.dataset.description  || '';
  if (type === 'unidad')    document.getElementById('catalog-abbreviation').value  = row.dataset.abbreviation || '';

  document.getElementById('modal-catalog-title').textContent = CATALOG_TITLES_EDIT[type] || 'Editar entrada';
  modalManager.open('modal-catalog');
}

/** Muestra u oculta los campos opcionales del modal según el tipo seleccionado. */
function setModalFieldsForType(type) {
  document.getElementById('field-catalog-description').style.display  = type === 'categoria' ? 'block' : 'none';
  document.getElementById('field-catalog-abbreviation').style.display = type === 'unidad'    ? 'block' : 'none';
}

function clearCatalogModal() {
  ['catalog-editing-id', 'catalog-name', 'catalog-description', 'catalog-abbreviation'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ── Guardar ───────────────────────────────────────────────────────────────

async function saveCatalogItem() {
  const name         = document.getElementById('catalog-name').value.trim();
  const type         = document.getElementById('catalog-type').value;
  const id           = document.getElementById('catalog-editing-id').value;
  const abbreviation = document.getElementById('catalog-abbreviation').value.trim();

  if (!name) {
    showToast(MSG.CATALOGS.NAME_REQUIRED, 'error');
    document.getElementById('catalog-name').focus();
    return;
  }

  const apiType = toApiType(type);
  const payload = { nombre: name };
  if (apiType === 'unidades') payload.abreviacion = abbreviation;

  try {
    store.setState({ ui: { loading: true } });
    id ? await window.CatalogService.update(apiType, id, payload)
       : await window.CatalogService.create(apiType, payload);

    const updated = await window.CatalogService.getAllCatalogs();
    store.setState({ catalogs: updated });
    renderTabla('categorias', updated.categorias);
    renderTabla('areas',      updated.areas);
    renderTabla('unidades',   updated.unidades);

    showToast(MSG.CATALOGS.SAVED, 'success');
    modalManager.close('modal-catalog');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    store.setState({ ui: { loading: false } });
  }
}

// ── Confirmar / ejecutar eliminación ─────────────────────────────────────

function confirmDelete(btn) {
  const row = btn.closest('tr');
  if (!row) return;
  pendingDeleteRow = row;
  document.getElementById('dialog-delete-name').textContent = ` "${row.dataset.name || 'este elemento'}" `;
  modalManager.open('dialog-confirm-delete');
}

async function executeDelete() {
  if (!pendingDeleteRow) { modalManager.close('dialog-confirm-delete'); return; }

  const row     = pendingDeleteRow;
  const name    = row.dataset.name    || 'elemento';
  const type    = row.dataset.tipo    || row.dataset.type || '';
  const id      = row.dataset.id      || row.dataset.itemId || '';
  const apiType = toApiType(type);

  try {
    store.setState({ ui: { loading: true } });
    await window.CatalogService.remove(apiType, id);

    row.style.transition = 'opacity 200ms ease';
    row.style.opacity    = '0';
    setTimeout(() => row.remove(), 200);

    const updated = await window.CatalogService.getAllCatalogs();
    store.setState({ catalogs: updated });
    renderTabla('categorias', updated.categorias);
    renderTabla('areas',      updated.areas);
    renderTabla('unidades',   updated.unidades);

    showToast(MSG.CATALOGS.DELETED(name), 'success');
    modalManager.close('dialog-confirm-delete');
    pendingDeleteRow = null;
  } catch (err) {
    showToast(err?.status === 409 ? MSG.CATALOGS.DELETE_HAS_PRODUCTS : err.message, 'error');
  } finally {
    store.setState({ ui: { loading: false } });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVEEDORES — CRUD
// ═══════════════════════════════════════════════════════════════════════════

async function loadProveedores() {
  try {
    store.setState({ ui: { loading: true } });
    const includeInactive = document.getElementById('chk-show-inactive-proveedores')?.checked || false;
    const res   = await window.ProviderService.getAll(includeInactive);
    proveedoresData = res?.data?.items || [];
    renderProveedores(proveedoresData);
  } catch (err) {
    showToast(err?.message || 'Error cargando proveedores', 'error');
  } finally {
    store.setState({ ui: { loading: false } });
  }
}

/** SVG ojo (activo) */
const ICON_EYE     = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
/** SVG ojo tachado (inactivo) */
const ICON_EYE_OFF = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function renderProveedores(items) {
  const tbody     = document.getElementById('proveedores-tbody');
  if (!tbody) return;

  const safeItems = Array.isArray(items) ? items.filter(i => i && typeof i === 'object') : [];

  if (!safeItems.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center; padding:32px 0;">No hay proveedores registrados</td></tr>';
    return;
  }

  tbody.innerHTML = safeItems.map(item => {
    const id       = window.escapeHtml(String(item.id || ''));
    const nombre   = window.escapeHtml(item.nombre   || '');
    const email    = window.escapeHtml(item.email    || '');
    const telefono = window.escapeHtml(item.telefono || '');
    const activo   = item.activo !== false && item.activo !== 0;
    const productos = window.escapeHtml(String(item.productos_asociados || 0));
    const rowStyle = activo ? '' : ' style="opacity:0.55;"';

    return `<tr data-id="${id}" data-nombre="${nombre}"${rowStyle}>
      <td>${nombre}</td>
      <td>${email}</td>
      <td>${telefono}</td>
      <td class="text-center">${activoBadge(activo)}</td>
      <td class="td-num">${productos}</td>
      <td class="td-actions">
        <button class="btn btn-ghost btn-icon" data-action="edit-prov" data-id="${id}" aria-label="Editar proveedor">${ICON_EDIT}</button>
        <button class="btn btn-ghost btn-icon" data-action="toggle-prov" data-id="${id}" aria-label="${activo ? 'Desactivar' : 'Activar'} proveedor">${activo ? ICON_EYE : ICON_EYE_OFF}</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Modal proveedor ───────────────────────────────────────────────────────

function openProveedorModal() {
  document.getElementById('proveedor-editing-id').value = '';
  document.getElementById('proveedor-nombre').value    = '';
  document.getElementById('proveedor-email').value     = '';
  document.getElementById('proveedor-telefono').value  = '';
  document.getElementById('modal-proveedor-title').textContent = 'Nuevo proveedor';
  modalManager.open('modal-proveedor');
  setTimeout(() => document.getElementById('proveedor-nombre').focus(), 100);
}

function editProveedor(id) {
  const item = proveedoresData.find(p => p.id === id);
  if (!item) return;
  document.getElementById('proveedor-editing-id').value = String(id);
  document.getElementById('proveedor-nombre').value     = item.nombre   || '';
  document.getElementById('proveedor-email').value      = item.email    || '';
  document.getElementById('proveedor-telefono').value   = item.telefono || '';
  document.getElementById('modal-proveedor-title').textContent = 'Editar proveedor';
  modalManager.open('modal-proveedor');
  setTimeout(() => document.getElementById('proveedor-nombre').focus(), 100);
}

async function saveProveedor() {
  const nombre   = document.getElementById('proveedor-nombre').value.trim();
  const email    = document.getElementById('proveedor-email').value.trim();
  const telefono = document.getElementById('proveedor-telefono').value.trim();
  const id       = document.getElementById('proveedor-editing-id').value;

  if (!nombre) {
    showToast(MSG.CATALOGS.NAME_REQUIRED, 'error');
    document.getElementById('proveedor-nombre').focus();
    return;
  }

  const payload = { nombre, email: email || null, telefono: telefono || null };

  try {
    store.setState({ ui: { loading: true } });
    if (id) {
      await window.ProviderService.update(parseInt(id, 10), payload);
      showToast(MSG.CATALOGS.PROVIDER_UPDATED, 'success');
    } else {
      await window.ProviderService.create(payload);
      showToast(MSG.CATALOGS.PROVIDER_CREATED, 'success');
    }
    modalManager.close('modal-proveedor');
    await loadProveedores();
  } catch (err) {
    showToast(err?.message || 'Error al guardar', 'error');
  } finally {
    store.setState({ ui: { loading: false } });
  }
}

// ── Toggle proveedor ──────────────────────────────────────────────────────

function confirmToggle(id) {
  const item = proveedoresData.find(p => p.id === id);
  if (!item) return;

  pendingToggleId = id;
  const activo    = item.activo !== false && item.activo !== 0;
  const nombre    = window.escapeHtml(item.nombre || '');
  const title     = document.getElementById('dialog-toggle-title');
  const desc      = document.getElementById('dialog-toggle-desc');

  if (activo) {
    title.textContent = 'Desactivar proveedor';
    title.className   = 'modal-title text-danger';
    desc.innerHTML    = `¿Desactivar al proveedor <strong>"${nombre}"</strong>? No aparecerá en listas de selección.`;
  } else {
    title.textContent = 'Activar proveedor';
    title.className   = 'modal-title text-success';
    desc.innerHTML    = `¿Reactivar al proveedor <strong>"${nombre}"</strong>?`;
  }
  modalManager.open('dialog-confirm-toggle');
}

async function executeToggle() {
  if (!pendingToggleId) { modalManager.close('dialog-confirm-toggle'); return; }
  const id = pendingToggleId;
  pendingToggleId = null;

  try {
    store.setState({ ui: { loading: true } });
    await window.ProviderService.toggle(id);
    modalManager.close('dialog-confirm-toggle');
    showToast(MSG.CATALOGS.STATUS_UPDATED, 'success');
    await loadProveedores();
  } catch (err) {
    showToast(err?.message || MSG.INVENTORY.TOGGLE_ERROR, 'error');
  } finally {
    store.setState({ ui: { loading: false } });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initActiveNav();

  // ── Tabs ─────────────────────────────────────────────────────────────
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

  // ── Botones de cabecera de panel (Agregar) ────────────────────────────
  document.getElementById('btn-add-categoria') ?.addEventListener('click', () => openCatalogModal('categoria'));
  document.getElementById('btn-add-unidad')    ?.addEventListener('click', () => openCatalogModal('unidad'));
  document.getElementById('btn-add-area')      ?.addEventListener('click', () => openCatalogModal('area'));
  document.getElementById('btn-add-proveedor') ?.addEventListener('click', openProveedorModal);

  // ── Botones de modales ────────────────────────────────────────────────
  document.getElementById('btn-save-catalog')  ?.addEventListener('click', saveCatalogItem);
  document.getElementById('btn-save-proveedor')?.addEventListener('click', saveProveedor);
  document.getElementById('btn-execute-delete')?.addEventListener('click', executeDelete);

  // ── Toggle checkbox inactivos proveedor ───────────────────────────────
  document.getElementById('chk-show-inactive-proveedores')
    ?.addEventListener('change', () => loadProveedores());

  // ── Confirm toggle (proveedor) ────────────────────────────────────────
  document.getElementById('btn-confirm-toggle')
    ?.addEventListener('click', executeToggle);

  // ── Event delegation: tablas de catálogos (editar / eliminar) ─────────
  ['categorias', 'unidades', 'areas'].forEach(tipo => {
    document.getElementById(tipo + '-tbody')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'edit')   editCatalogItem(btn);
      if (btn.dataset.action === 'delete') confirmDelete(btn);
    });
  });

  // ── Event delegation: tabla de proveedores ────────────────────────────
  document.getElementById('proveedores-tbody')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === 'edit-prov')   editProveedor(id);
    if (btn.dataset.action === 'toggle-prov') confirmToggle(id);
  });

  loadCatalogos();
  loadProveedores();
});
